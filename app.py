import streamlit as st
from dotenv import load_dotenv
from google.cloud import aiplatform
import vertexai
from vertexai.generative_models import GenerativeModel, GenerationConfig
import assemblyai as aai



def main():
    st.set_page_config(page_title="Meeting Minutes Generator",
                       page_icon="🔖", layout='wide')
    st.title(":violet[🔖 Meeting Minutes Generator]")
    
    with st.sidebar:
        with st.expander("📍**關於 Meeting Minutes Generator**", expanded=True):
            st.markdown('''
                    - **希望能加速會議紀錄初稿產生，協助大家更好的解決會議紀錄耗時的問題**
                    - 目前限制，因為主要的語音轉文字的部分是免費服務，:red[每個月只有 100/hr 語音轉文字的使用額度]，所以節約使用
                    - 會:red[通過 Gemini-1.5 API 來進行會議紀錄整理]，可以將剛剛下載的部分在此頁貼上後提供必要資訊並進行會議紀錄整理
                    ''')
            st.divider()
            st.markdown('''有任何問題都歡迎找 Max 
                        \n 📧 : max.chen@hkmci.com
                        ''')
    
    vertexai.init(project=project_id, location=region)
    aiplatform.init(project=project_id, location=region)
    aai.settings.api_key = aai_apiKey
    
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
    col1,col2 = st.columns(2)
    with col1:
        meeting_lang = st.selectbox(":blue[**選擇會議語言**]", ["中文", "英文"])
        if meeting_lang == "中文":
            lang = "zh"
        else:
            lang = "en"
    with col2:
        punctuate = st.checkbox(":blue[**是否需要標點**]", value=True)
        format_text = st.checkbox(":blue[**是否需要格式化(大小寫)**]", value=True)
        speaker_labels = st.checkbox(":blue[**是否需要標註說話人**]", value=False)
        if speaker_labels == True:
            speaker_num = st.number_input(":blue[**輸入說話人數量**]", min_value=1, max_value=10, value=1)
    
    meeting_info = st.text_area(":orange[**輸入會議相關資訊**]", height=150, placeholder="請輸入會議名稱、日期、時間、地點、出席人員、主持人、議程等相關資訊")
    upload_audio = st.file_uploader(":orange[上傳**會議錄音檔案** 🎤(支援常見音頻格式, m4a,mp3,wav...)]", type=["m4a","mp3","wav"],accept_multiple_files=False)
    if upload_audio is not None:
        audio_bytes = upload_audio.read()
        start_trans = st.button("製作會議紀錄")
        
        if start_trans:
            with st.spinner("會議紀錄轉文字中"):
                if speaker_labels == True:
                    config = aai.TranscriptionConfig(punctuate=punctuate, format_text=format_text, language_code=lang, speaker_labels=True, speakers_expected=speaker_num)
                else:
                    config = aai.TranscriptionConfig(punctuate=punctuate, format_text=format_text, language_code=lang)
                transcriber = aai.Transcriber(config=config)
                transcript = transcriber.transcribe(audio_bytes)
                if transcript.status == aai.TranscriptStatus.error:
                    st.error(transcript.error)
                else:
                    st.markdown(":blue[**會議逐字稿完成 :**]")
                    with st.expander("👨🏻‍💻**會議逐字稿**", expanded=False):
                        st.write(transcript.text)
                st.success("逐字稿完成")
            st.divider()    
            
            with st.spinner("會議紀錄整理中"):
                prompt = f"""您的任務是查看提供的會議記錄並創建一個簡潔的摘要來捕獲基本信息，重點關注會議期間的關鍵要點和行動項目。使用清晰、專業的語言，並使用標題、副標題和項目符號等適當的格式以邏輯方式組織摘要。確保摘要易於理解，並對會議內容提供全面而簡潔的概述，特別注重明確指出每個行動項目。 ---\n 本次會議的基本資訊：\n{meeting_info}\n---\n 會議錄音轉成逐字稿：\n{transcript.text}"""
                response = textgen_model.generate_content(
                    contents=prompt,
                    generation_config=generation_config,
                    safety_settings=safety_config,
                )
                st.markdown(":blue[**會議紀錄整理完成 :**]")
                st.success("會議紀錄整理完成")
                st.write(response.text)

if __name__ == "__main__":
    load_dotenv()
    
    # 全局變量
    project_id = st.secrets["project_id"]
    region = st.secrets["region"]
    aai_apiKey = st.secrets["aai_apiKey"]
    
    main()