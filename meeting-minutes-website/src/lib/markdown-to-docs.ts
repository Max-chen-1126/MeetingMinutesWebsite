// src/lib/markdown-to-docs.ts
import { marked } from 'marked';

export interface GoogleDocsRequest {
  insertText?: {
    location: { index: number };
    text: string;
  };
  updateParagraphStyle?: {
    range: { startIndex: number; endIndex: number };
    paragraphStyle: {
      namedStyleType: string;
    };
    fields: string;
  };
  updateTextStyle?: {
    range: { startIndex: number; endIndex: number };
    textStyle: {
      bold?: boolean;
      italic?: boolean;
      strikethrough?: boolean;
    };
    fields: string;
  };
  insertTable?: {
    location: { index: number };
    rows: number;
    columns: number;
  };
  insertTableRow?: {
    tableCellLocation: {
      tableStartLocation: { index: number };
      rowIndex: number;
      columnIndex: number;
    };
    insertBelow: boolean;
  };
  insertTableColumn?: {
    tableCellLocation: {
      tableStartLocation: { index: number };
      rowIndex: number;
      columnIndex: number;
    };
    insertRight: boolean;
  };
}

export class MarkdownToDocsConverter {
  private requests: GoogleDocsRequest[] = [];
  private currentIndex = 1;

  /**
   * 將 Markdown 內容轉換為 Google Docs API 請求
   * @param markdownContent Markdown 內容
   * @returns Google Docs API 請求陣列
   */
  convert(markdownContent: string): GoogleDocsRequest[] {
    // 重置狀態
    this.requests = [];
    this.currentIndex = 1;

    try {
      // 解析 Markdown 內容
      const tokens = marked.lexer(markdownContent);
      
      // 處理每個 token
      tokens.forEach(token => {
        this.processToken(token);
      });

      return this.requests;
    } catch (error) {
      console.error('Markdown 解析錯誤:', error);
      // 如果解析失敗，回退到簡單的文字處理
      return this.convertPlainText(markdownContent);
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private processToken(token: any): void {
    switch (token.type) {
      case 'heading':
        this.addHeading(token.text, token.depth);
        break;
      case 'paragraph':
        this.addParagraph(token.text);
        break;
      case 'list':
        this.addList(token.items, token.ordered);
        break;
      case 'table':
        this.addTable(token.header, token.rows);
        break;
      case 'code':
        this.addCodeBlock(token.text);
        break;
      case 'blockquote':
        this.addBlockquote(token.text);
        break;
      case 'hr':
        this.addHorizontalRule();
        break;
      default:
        // 處理其他類型的 token
        if (token.text) {
          this.addParagraph(token.text);
        }
    }
  }

  private addHeading(text: string, level: number): void {
    const cleanText = this.cleanText(text);
    const textWithNewline = cleanText + '\n';
    
    // 插入標題文字
    this.requests.push({
      insertText: {
        location: { index: this.currentIndex },
        text: textWithNewline
      }
    });

    // 設定標題樣式
    const headingStyles = {
      1: 'HEADING_1',
      2: 'HEADING_2',
      3: 'HEADING_3',
      4: 'HEADING_4',
      5: 'HEADING_5',
      6: 'HEADING_6'
    };

    this.requests.push({
      updateParagraphStyle: {
        range: {
          startIndex: this.currentIndex,
          endIndex: this.currentIndex + cleanText.length
        },
        paragraphStyle: {
          namedStyleType: headingStyles[level as keyof typeof headingStyles] || 'HEADING_1'
        },
        fields: 'namedStyleType'
      }
    });

    this.currentIndex += textWithNewline.length;
  }

  private addParagraph(text: string): void {
    const cleanText = this.cleanText(text);
    const textWithNewline = cleanText + '\n';
    
    this.requests.push({
      insertText: {
        location: { index: this.currentIndex },
        text: textWithNewline
      }
    });

    this.currentIndex += textWithNewline.length;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private addList(items: any[], ordered: boolean = false): void {
    items.forEach((item, index) => {
      const prefix = ordered ? `${index + 1}. ` : '• ';
      const cleanText = this.cleanText(item.text);
      const textWithNewline = prefix + cleanText + '\n';
      
      this.requests.push({
        insertText: {
          location: { index: this.currentIndex },
          text: textWithNewline
        }
      });

      this.currentIndex += textWithNewline.length;
    });
  }

  private addTable(header: string[], rows: string[][]): void {
    // 插入表格
    const tableRows = rows.length + 1; // +1 for header
    const tableCols = header.length;
    
    this.requests.push({
      insertTable: {
        location: { index: this.currentIndex },
        rows: tableRows,
        columns: tableCols
      }
    });

    // 注意：實際的表格內容填充需要更複雜的邏輯
    // 這裡僅作為基本實現，實際使用時可能需要調整
    this.currentIndex += 2; // 表格會佔用一些空間
  }

  private addCodeBlock(code: string): void {
    const codeText = '```\n' + code + '\n```\n';
    
    this.requests.push({
      insertText: {
        location: { index: this.currentIndex },
        text: codeText
      }
    });

    this.currentIndex += codeText.length;
  }

  private addBlockquote(text: string): void {
    const cleanText = this.cleanText(text);
    const quotedText = '> ' + cleanText + '\n';
    
    this.requests.push({
      insertText: {
        location: { index: this.currentIndex },
        text: quotedText
      }
    });

    this.currentIndex += quotedText.length;
  }

  private addHorizontalRule(): void {
    const hrText = '---\n';
    
    this.requests.push({
      insertText: {
        location: { index: this.currentIndex },
        text: hrText
      }
    });

    this.currentIndex += hrText.length;
  }

  /**
   * 清理文字，移除 HTML 標籤和特殊字符
   * @param text 原始文字
   * @returns 清理後的文字
   */
  private cleanText(text: string): string {
    if (!text) return '';
    
    // 移除 HTML 標籤
    let cleaned = text.replace(/<[^>]*>/g, '');
    
    // 移除多餘的空白字符
    cleaned = cleaned.replace(/\s+/g, ' ').trim();
    
    return cleaned;
  }

  /**
   * 回退方法：將純文字轉換為 Google Docs 請求
   * @param content 純文字內容
   * @returns Google Docs API 請求陣列
   */
  private convertPlainText(content: string): GoogleDocsRequest[] {
    const requests: GoogleDocsRequest[] = [];
    
    // 按行分割內容
    const lines = content.split('\n');
    let currentIndex = 1;
    
    lines.forEach(line => {
      if (line.trim()) {
        // 檢查是否是標題（以 # 開始）
        const headingMatch = line.match(/^(#{1,6})\s*(.*)$/);
        if (headingMatch) {
          const level = headingMatch[1].length;
          const text = headingMatch[2].trim();
          const textWithNewline = text + '\n';
          
          // 插入標題文字
          requests.push({
            insertText: {
              location: { index: currentIndex },
              text: textWithNewline
            }
          });

          // 設定標題樣式
          const headingStyles = ['HEADING_1', 'HEADING_2', 'HEADING_3', 'HEADING_4', 'HEADING_5', 'HEADING_6'];
          requests.push({
            updateParagraphStyle: {
              range: {
                startIndex: currentIndex,
                endIndex: currentIndex + text.length
              },
              paragraphStyle: {
                namedStyleType: headingStyles[level - 1] || 'HEADING_1'
              },
              fields: 'namedStyleType'
            }
          });

          currentIndex += textWithNewline.length;
        } else {
          // 一般段落
          const textWithNewline = line + '\n';
          requests.push({
            insertText: {
              location: { index: currentIndex },
              text: textWithNewline
            }
          });
          currentIndex += textWithNewline.length;
        }
      } else {
        // 空行
        requests.push({
          insertText: {
            location: { index: currentIndex },
            text: '\n'
          }
        });
        currentIndex += 1;
      }
    });

    return requests;
  }
}

/**
 * 簡化的 Markdown 轉換函數
 * @param markdownContent Markdown 內容
 * @returns Google Docs API 請求陣列
 */
export function convertMarkdownToGoogleDocs(markdownContent: string): GoogleDocsRequest[] {
  const converter = new MarkdownToDocsConverter();
  return converter.convert(markdownContent);
}