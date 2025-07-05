// src/lib/markdown-to-docs.ts
import { marked, Token } from 'marked';

export interface GoogleDocsRequest {
  insertText?: {
    location: { index: number };
    text: string;
  };
  updateParagraphStyle?: {
    range: { startIndex: number; endIndex: number };
    paragraphStyle: {
      namedStyleType?: string;
      // [最終修復] 補充 padding 屬性
      borderBottom?: {
        width: { magnitude: number; unit: string };
        padding: { magnitude: number; unit: string };
        dashStyle: string;
        color: { color: { rgbColor: { red: number; green: number; blue: number } } };
      };
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

  constructor() {
    marked.setOptions({
      gfm: true,
      breaks: false,
      pedantic: false,
    });
  }

  convert(markdownContent: string): GoogleDocsRequest[] {
    this.requests = [];
    this.currentIndex = 1;

    try {
      const tokens = marked.lexer(markdownContent);
      
      const tableStartLocations: { [key: number]: number } = {};
      let tokenIndex = 0;
      // 預處理以估算索引，這是一個簡化的方法，對於複雜文檔可能需要更精確的計算
      const estimatedRequests = this.generateRequests(tokens, true, tableStartLocations);
      this.currentIndex = estimatedRequests.reduce((acc, req) => {
          if (req.insertText?.text) return acc + req.insertText.text.length;
          return acc;
      }, 1);

      // 重置並生成真正的請求
      this.currentIndex = 1;
      this.requests = this.generateRequests(tokens, false, tableStartLocations);

      return this.requests;
    } catch (error) {
      console.error('Markdown 解析錯誤:', error);
      return this.convertPlainText(markdownContent);
    }
  }

  // 將 Token 處理邏輯提取到一個可重複使用的函式中
  private generateRequests(tokens: Token[], isDryRun: boolean, tableStartLocations: { [key: number]: number }): GoogleDocsRequest[] {
    const originalRequests = this.requests;
    const originalIndex = this.currentIndex;
    
    if (!isDryRun) {
        this.requests = [];
    }
    
    let tokenIndex = 0;
    for(const token of tokens) {
      if (isDryRun && token.type === 'table') {
        tableStartLocations[tokenIndex] = this.currentIndex;
      }
      this.processToken(token, tableStartLocations[tokenIndex]);
      tokenIndex++;
    }

    const finalRequests = this.requests;
    this.requests = originalRequests;
    this.currentIndex = originalIndex;

    return finalRequests;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private processToken(token: any, tableStartLocation?: number): void {
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
        this.addTable(token.header, token.rows, tableStartLocation as number);
        break;
      case 'code':
        this.addCodeBlock(token.text, token.lang);
        break;
      case 'blockquote':
        this.addBlockquote(token.text);
        break;
      case 'hr':
        this.addHorizontalRule();
        break;
      case 'space':
        this.addTextSegment('\n');
        break;
      default:
        if (token.raw) {
          this.addParagraph(token.raw);
        }
    }
  }
  
  private addHeading(text: string, level: number): void {
    const startIndex = this.currentIndex;
    this.processInlineText(text);
    this.addTextSegment('\n');

    const headingStyle = `HEADING_${level}`;
    this.requests.push({
      updateParagraphStyle: {
        range: {
          startIndex,
          endIndex: this.currentIndex,
        },
        paragraphStyle: {
          namedStyleType: headingStyle,
        },
        fields: 'namedStyleType',
      },
    });
  }

  private addParagraph(text: string): void {
    this.processInlineText(text);
    this.addTextSegment('\n');
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private addList(items: any[], ordered: boolean = false): void {
    items.forEach((item, index) => {
        const bullet = ordered ? `${index + 1}. ` : '• ';
        this.addTextSegment(bullet);
        
        if (item.tokens && item.tokens.length > 0) {
            item.tokens.forEach((subToken: any) => {
                if (subToken.type === 'text') {
                    this.processInlineText(subToken.text);
                } else if (subToken.type === 'list') {
                    this.addTextSegment('\n');
                    this.addList(subToken.items, subToken.ordered);
                }
            });
        }
        
        this.addTextSegment('\n');
    });
  }

  private addTable(header: string[], rows: string[][], tableStartLocation: number): void {
    const numRows = rows.length + 1;
    const numCols = header.length;

    this.requests.push({
      insertTable: {
        location: { index: tableStartLocation },
        rows: numRows,
        columns: numCols,
      },
    });

    let tableContent = '';
    const allRows = [header, ...rows];
    
    allRows.forEach(row => {
      row.forEach((cell, cellIndex) => {
        const cellText = this.cleanText(cell || '');
        tableContent += cellText;
        if (cellIndex < numCols - 1) {
          tableContent += '\t';
        }
      });
      tableContent += '\n';
    });
    
    if (tableContent) {
        this.requests.push({
            insertText: {
                location: { index: tableStartLocation + 4 },
                text: tableContent,
            }
        });
    }
  }

  private addCodeBlock(code: string, lang: string = ''): void {
    const codeBlockText = `\`\`\`${lang}\n${code}\n\`\`\`\n`;
    this.addTextSegment(codeBlockText);
  }

  private addBlockquote(text: string): void {
    text.split('\n').forEach(line => {
        if (line) {
            this.addTextSegment(`> ${line}\n`);
        }
    });
  }

  private addHorizontalRule(): void {
    const startIndex = this.currentIndex;
    this.addTextSegment('\n');
    
    this.requests.push({
      updateParagraphStyle: {
        range: {
          startIndex: startIndex,
          endIndex: this.currentIndex,
        },
        paragraphStyle: {
          borderBottom: {
            // [最終修復] 明確提供 padding 屬性來解決 UNIT_UNSPECIFIED 錯誤
            width: { magnitude: 1, unit: 'PT' },
            padding: { magnitude: 3, unit: 'PT' },
            dashStyle: 'SOLID',
            color: {
              color: {
                rgbColor: { red: 0.8, green: 0.8, blue: 0.8 }
              }
            }
          },
        },
        fields: 'borderBottom',
      },
    });
  }
  
  private cleanText(text: string): string {
    if (!text) return '';
    let cleaned = text.replace(/<[^>]*>/g, '');
    cleaned = cleaned.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&').replace(/&quot;/g, '"');
    return cleaned.trim();
  }

  private processInlineText(text: string): void {
    // 簡單地處理粗體、斜體、刪除線，避免過度匹配
    const regex = /(\*\*|__)(.*?)\1|(\*|_)(.*?)\3|(~~)(.*?)\5/g;
    let lastIndex = 0;
    let match;

    while ((match = regex.exec(text)) !== null) {
      if (match.index > lastIndex) {
        this.addTextSegment(this.cleanText(text.substring(lastIndex, match.index)));
      }

      let innerText = '';
      const textStyle: { bold?: boolean; italic?: boolean; strikethrough?: boolean; } = {};

      if (match[2] !== undefined) {
        innerText = match[2];
        textStyle.bold = true;
      } else if (match[4] !== undefined) {
        innerText = match[4];
        textStyle.italic = true;
      } else if (match[6] !== undefined) {
        innerText = match[6];
        textStyle.strikethrough = true;
      }

      if (innerText) {
        const startOfStyledText = this.currentIndex;
        const cleanedInnerText = this.cleanText(innerText);
        this.addTextSegment(cleanedInnerText);

        if (Object.keys(textStyle).length > 0) {
            this.requests.push({
              updateTextStyle: {
                range: {
                  startIndex: startOfStyledText,
                  endIndex: this.currentIndex
                },
                textStyle: textStyle,
                fields: Object.keys(textStyle).join(',')
              }
            });
        }
      }
      lastIndex = regex.lastIndex;
    }

    if (lastIndex < text.length) {
      this.addTextSegment(this.cleanText(text.substring(lastIndex)));
    }
  }

  private addTextSegment(text: string): void {
    if (!text) return;
    this.requests.push({
      insertText: {
        location: { index: this.currentIndex },
        text: text
      }
    });
    this.currentIndex += text.length;
  }
    
  private convertPlainText(content: string): GoogleDocsRequest[] {
    const requests: GoogleDocsRequest[] = [];
    let currentIndex = 1;
    content.split('\n').forEach(line => {
        const textWithNewline = line + '\n';
        requests.push({
          insertText: {
            location: { index: currentIndex },
            text: textWithNewline
          }
        });
        currentIndex += textWithNewline.length;
    });
    return requests;
  }
}

export function convertMarkdownToGoogleDocs(markdownContent: string): GoogleDocsRequest[] {
  const converter = new MarkdownToDocsConverter();
  return converter.convert(markdownContent);
}