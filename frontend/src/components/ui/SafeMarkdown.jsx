import React from "react";
import ReactMarkdown from "react-markdown";

// Strict HTML tag stripping for raw tags that might sneak through in custom components
const DISALLOWED_TAGS = ["script", "iframe", "object", "embed", "style", "noscript", "meta", "link", "svg"];

const safeComponents = {
  a: ({ href, children, ...props }) => {
    // Only allow http://, https://, relative path "/", or anchor links "#" to prevent javascript: XSS
    const isSafe = href && (
      href.startsWith("http://") || 
      href.startsWith("https://") || 
      href.startsWith("/") || 
      href.startsWith("#")
    );
    return (
      <a 
        href={isSafe ? href : "#"} 
        target={isSafe && href.startsWith("http") ? "_blank" : undefined} 
        rel={isSafe && href.startsWith("http") ? "noopener noreferrer" : undefined} 
        {...props}
      >
        {children}
      </a>
    );
  },
  img: ({ src, ...props }) => {
    // Only allow http://, https://, relative path "/", or safe base64 images to prevent XSS
    const isSafe = src && (
      src.startsWith("http://") || 
      src.startsWith("https://") || 
      src.startsWith("data:image/") ||
      src.startsWith("/")
    );
    if (!isSafe) return null;
    return <img src={src} {...props} />;
  }
};

export default function SafeMarkdown({ children, ...props }) {
  return (
    <ReactMarkdown
      components={safeComponents}
      disallowedElements={DISALLOWED_TAGS}
      unwrapDisallowed={true}
      {...props}
    >
      {children}
    </ReactMarkdown>
  );
}
