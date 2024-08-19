import streamlit as st
from dotenv import load_dotenv
from google.cloud import aiplatform, storage
from google.cloud.speech_v2 import SpeechClient
from google.cloud.speech_v2.types import cloud_speech
from google.api_core.client_options import ClientOptions
import vertexai
from vertexai.generative_models import GenerativeModel, GenerationConfig
import io
import os
import tempfile
from pydub import AudioSegment

MAX_AUDIO_LENGTH_SECS = 8 * 60 * 60  # 8 hours


def upload_blob(bucket_name, source_file_name, destination_blob_name):
    storage_client = storage.Client()
    bucket = storage_client.bucket(bucket_name)
    blob = bucket.blob(destination_blob_name)
    blob.upload_from_filename(source_file_name)


def transcribe_with_google(audio_file, language_code, speaker_diarization=False, speaker_count=None):
    # 設置 GCS 路徑
    bucket_name = "your-bucket-name"  # 替換為您的 GCS bucket 名稱
    audio_gcs_uri = f"gs://{bucket_name}/meeting_audio.wav"
    gcs_output_folder = f"gs://{bucket_name}/transcripts"

    # 上傳音頻文件到 GCS
    with tempfile.NamedTemporaryFile(delete=False, suffix=".wav") as temp_audio:
        audio = AudioSegment.from_file(audio_file)
        audio.export(temp_audio.name, format="wav")
        upload_blob(bucket_name, temp_audio.name, "meeting_audio.wav")

    # 初始化 Speech client
    client = SpeechClient(
        client_options=ClientOptions(
            api_endpoint="us-central1-speech.googleapis.com",
        ),
    )

    # 設置識別配置
    config = cloud_speech.RecognitionConfig(
        explicit_decoding_config=cloud_speech.ExplicitDecodingConfig(
            encoding=cloud_speech.RecognitionConfig.AudioEncoding.LINEAR16,
            sample_rate_hertz=44100,
            audio_channel_count=2
        ),
        model="chirp_2",
        language_codes=[language_code],
        features=cloud_speech.RecognitionFeatures(
            enable_automatic_punctuation=True,
            enable_spoken_punctuation=True,
            enable_spoken_emojis=True,
            enable_speaker_diarization=speaker_diarization,
            diarization_speaker_count=speaker_count
        )
    )

    output_config = cloud_speech.RecognitionOutputConfig(
        gcs_output_config=cloud_speech.GcsOutputConfig(uri=gcs_output_folder),
    )

    files = [cloud_speech.BatchRecognizeFileMetadata(uri=audio_gcs_uri)]

    request = cloud_speech.BatchRecognizeRequest(
        recognizer=f"projects/{project_id}/locations/us-central1/recognizers/_",
        config=config,
        files=files,
        recognition_output_config=output_config,
    )

    operation = client.batch_recognize(request=request)
    st.info("正在處理音頻文件，這可能需要一些時間...")
    response = operation.result(timeout=3 * MAX_AUDIO_LENGTH_SECS)

    # 從 GCS 獲取轉錄結果
    storage_client = storage.Client()
    bucket = storage_client.get_bucket(bucket_name)
    transcript_blob = list(bucket.list_blobs(prefix="transcripts/"))[0]
    transcript = transcript_blob.download_as_text()

    return transcript


def main():
    st.set_page_config(page_title="Meeting Minutes Generator",
                       page_icon="🔖", layout='wide')
    st.title(":violet[🔖 Meeting Minutes Generator]")

    with st.sidebar:
        with st.expander("📍**關於 Meeting Minutes Generator**", expanded=True):
            st.markdown('''
                    - **希望能加速會議紀錄初稿產生，協助大家更好的解決會議紀錄耗時的問題**
                    - 使用 Google Chirp2 模型進行語音轉文字
                    - 會:red[通過 Gemini-1.5 API 來進行會議紀錄整理]，可以將剛剛下載的部分在此頁貼上後提供必要資訊並進行會議紀錄整理
                    ''')
            st.divider()
            st.markdown('''有任何問題都歡迎找 Max 
                        \n 📧 : max.chen@hkmci.com
                        ''')

    vertexai.init(project=project_id, location=region)
    aiplatform.init(project=project_id, location=region)

    textgen_model = GenerativeModel("gemini-1.5-flash")
    generation_config = GenerationConfig(
        temperature=0.1,
        top_p=0.8,
        top_k=5,
        candidate_count=1,
        max_output_tokens=2048,
    )
    safety_config = [
        vertexai.generative_models.SafetySetting(
            category=vertexai.generative_models.HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
            threshold=vertexai.generative_models.HarmBlockThreshold.BLOCK_ONLY_HIGH,
        ),
        vertexai.generative_models.SafetySetting(
            category=vertexai.generative_models.HarmCategory.HARM_CATEGORY_HARASSMENT,
            threshold=vertexai.generative_models.HarmBlockThreshold.BLOCK_ONLY_HIGH,
        ),
    ]

    # 設定轉文字參數
    col1, col2 = st.columns(2)
    with col1:
        meeting_lang = st.selectbox(":blue[**選擇會議語言**]", ["中文", "英文"])
        lang = "cmn-Hans-CN" if meeting_lang == "中文" else "en-US"
    with col2:
        speaker_labels = st.checkbox(":blue[**是否需要標註說話人**]", value=False)
        if speaker_labels:
            speaker_num = st.number_input(
                ":blue[**輸入說話人數量**]", min_value=2, max_value=10, value=2)

    meeting_info = st.text_area(
        ":orange[**輸入會議相關資訊**]", height=150, placeholder="請輸入會議名稱、日期、時間、地點、出席人員、主持人、議程等相關資訊")
    upload_audio = st.file_uploader(
        ":orange[上傳**會議錄音檔案** 🎤(支援常見音頻格式, m4a,mp3,wav...)]", type=["mp3"], accept_multiple_files=False)
    if upload_audio is not None:
        start_trans = st.button("製作會議紀錄")

        if start_trans:
            with st.spinner("會議紀錄轉文字中"):
                try:
                    transcript = transcribe_with_google(
                        upload_audio, lang, speaker_labels, speaker_num if speaker_labels else None)
                    st.markdown(":blue[**會議逐字稿完成 :**]")
                    with st.expander("👨🏻‍💻**會議逐字稿**", expanded=False):
                        st.write(transcript)
                    st.success("逐字稿完成")
                except Exception as e:
                    st.error(f"轉錄過程中發生錯誤: {str(e)}")
                    return

            st.divider()

            with st.spinner("會議紀錄整理中"):
                try:
                    prompt = f"""你現在是一位專業的會議記錄員，擅長製作詳盡而結構清晰的會議紀錄。你的任務是根據提供的 [會議逐字稿] 創建一份完整、詳細且組織有序的會議紀錄。請遵循以下指引：
                                1. 輸出格式：
                                - 使用繁體中文
                                - 採用 Markdown 格式

                                2. 會議紀錄結構：
                                a) 會議概要：
                                    - 簡要說明會議的主要目標
                                    - 概述會議的關鍵成果
                                
                                b) 詳細討論項目：
                                    - 列出每個討論項目
                                    - 對於每個項目，詳細記錄每個討論的詳細內容
                                
                                c) 重要決策：
                                    - 列出會議中做出的所有重要決策
                                
                                d) 行動項目：
                                    - 記錄所有被指派的任務
                                    - 包括負責人和截止日期（如有提及）
                                
                                e) 未解決問題：
                                    - 列出任何尚未解決的問題或需要後續跟進的事項

                                3. 內容要求：
                                - 確保準確捕捉所有關鍵點
                                - 保持客觀，不加入個人意見
                                - 使用清晰、專業的語言
                                - 適當使用標題、子標題、項目符號等，提高可讀性

                                4. 額外注意事項：
                                - 如遇到不清楚或模糊的部分，請標註 [待確認] 以便後續跟進
                                - 對於敏感或機密信息，請標註 [機密] 
                                - 在紀錄中保留原始發言者的身份（如有提及）

                                請記住，這份會議紀錄對我的職業發展極為重要。請仔細審視並確保內容的準確性和完整性。

                                準備好並確認你已經已經理解了這些指示，並以我提供 [會議逐字稿] 以開始工作。\n 本次會議的基本資訊：\n{meeting_info}\n---\n 會議逐字稿：\n[[[{transcript}]]]"""
                    response = textgen_model.generate_content(
                        contents=prompt,
                        generation_config=generation_config,
                        safety_settings=safety_config,
                    )
                    st.markdown(":blue[**會議紀錄整理完成 :**]")
                    st.success("會議紀錄整理完成")
                    st.write(response.text)
                except Exception as e:
                    st.error(f"生成會議紀錄時發生錯誤: {str(e)}")


if __name__ == "__main__":
    load_dotenv()

    # 全局變量
    project_id = st.secrets["project_id"]
    region = st.secrets["region"]

    main()
