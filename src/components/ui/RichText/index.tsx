import React from "react";
import ReactMarkdown from "react-markdown";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";

interface RichTextProps {
  children: string;
  className?: string;
}

export function RichText({ children, className }: RichTextProps) {
  return (
    <div className={className} style={{ lineHeight: 1.6 }}>
      <ReactMarkdown
        components={{
          code(props) {
            const { className: cls, children: codeChildren } = props;
            const match = /language-(\w+)/.exec(cls || "");
            const codeStr = String(codeChildren).replace(/\n$/, "");
            const isBlock = !!match || codeStr.includes("\n");

            if (isBlock) {
              return (
                <SyntaxHighlighter
                  style={oneDark}
                  language={match?.[1] || "text"}
                  PreTag="div"
                  customStyle={{ borderRadius: 6, fontSize: 13, margin: "8px 0" }}
                >
                  {codeStr}
                </SyntaxHighlighter>
              );
            }

            return (
              <code
                style={{
                  background: "var(--code-inline-bg)",
                  color: "var(--code-inline-color)",
                  padding: "2px 6px",
                  borderRadius: 4,
                  fontFamily: "monospace",
                  fontSize: "0.875em",
                }}
              >
                {codeChildren}
              </code>
            );
          },
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
