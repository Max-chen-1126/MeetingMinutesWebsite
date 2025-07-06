// src/lib/markdown-to-docs.ts
import { marked, Token, Tokens } from 'marked';

export interface GoogleDocsRequest {
  insertText?: {
    location: { index: number };
    text: string;
  };
  updateParagraphStyle?: {
    range: { startIndex: number; endIndex: number };
    paragraphStyle: {
      namedStyleType?: string;
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
      
      // Dry run pass to calculate table locations.
      // We call the function for its side effect, not its return value.
      this.generateRequests(tokens, true, tableStartLocations);
      
      // Reset and perform the real request generation
      this.currentIndex = 1;
      this.requests = this.generateRequests(tokens, false, tableStartLocations);

      return this.requests;
    } catch (error) {
      console.error('Markdown 解析錯誤:', error);
      return this.convertPlainText(markdownContent);
    }
  }

  // This function processes tokens to generate requests, used for both dry runs and final conversion.
  private generateRequests(tokens: Token[], isDryRun: boolean, tableStartLocations: { [key: number]: number }): GoogleDocsRequest[] {
    const originalRequests = this.requests;
    const originalIndex = this.currentIndex;
    
    // For the final run, start with a clean request array.
    if (!isDryRun) {
        this.requests = [];
    }
    
    // Loop through tokens to process them
    tokens.forEach((token, index) => {
      // During the dry run, record the calculated start location for any table.
      if (isDryRun && token.type === 'table') {
        tableStartLocations[index] = this.currentIndex;
      }
      // Process the token, which updates currentIndex and may add requests.
      this.processToken(token, tableStartLocations[index]);
    });

    const finalRequests = this.requests;
    
    // Restore original state so the two passes don't interfere.
    this.requests = originalRequests;
    this.currentIndex = originalIndex;

    return finalRequests;
  }
  
  // The eslint-disable is a pragmatic choice here as `token` is a union of many possible types from `marked`.
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
        // The `items` property is specific to list tokens.
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

  private addList(items: Tokens.ListItem[], ordered: boolean = false): void {
    items.forEach((item) => {
        const bullet = ordered ? `${item.task ? '[ ]' : ''}* ` : '• ';
        this.addTextSegment(bullet);
        
        // Process the text content within the list item.
        if (item.tokens && item.tokens.length > 0) {
            item.tokens.forEach((subToken: Token) => {
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

  private addTable(header: string[], rows: (string[])[], tableStartLocation: number): void {
    const numRows = rows.length + 1;
    const numCols = header.length > 0 ? header.length : (rows[0]?.length || 1);

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
      // Ensure row is an array before calling forEach
      if (Array.isArray(row)) {
        row.forEach((cell, cellIndex) => {
          const cellText = this.cleanText(cell || '');
          tableContent += cellText;
          if (cellIndex < numCols - 1) {
            tableContent += '\t';
          }
        });
      }
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