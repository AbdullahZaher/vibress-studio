import React, { useId, useState } from 'react';
import { Bookmark, Link, type LucideIcon } from 'lucide-react';

const ICONS: Record<string, LucideIcon> = {
  bookmark: Bookmark,
  embed: Link,
};

interface UrlPlaceholderProps {
  iconType: 'bookmark' | 'embed';
  title: string;
  description: string;
  onUrlSubmit: (url: string) => void;
  /** Optional validator; when it returns false the error message is shown. */
  validate?: (url: string) => boolean;
  isSelected?: boolean;
  onClick?: (e: React.MouseEvent) => void;
}

export function UrlPlaceholder({
  iconType,
  title,
  description,
  onUrlSubmit,
  validate,
  isSelected = false,
  onClick,
}: UrlPlaceholderProps) {
  const Icon = ICONS[iconType] || Bookmark;
  const [url, setUrl] = useState('');
  const [error, setError] = useState<string | null>(null);
  const inputId = useId();
  const errorId = useId();

  const handleClick = (e: React.MouseEvent) => {
    if (onClick) onClick(e);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = url.trim();
    if (!trimmed) {
      setError('Please enter a URL.');
      return;
    }
    if (validate && !validate(trimmed)) {
      setError('That URL is not valid or is not supported.');
      return;
    }
    setError(null);
    onUrlSubmit(trimmed);
  };

  return (
    <div
      className="relative flex flex-col items-center justify-center p-8 my-4 border-2 border-dashed border-gray-200 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors group"
      onClick={handleClick}
      style={{ outline: isSelected ? '2px solid #3b82f6' : 'none' }}
    >
      <div className="flex flex-col items-center justify-center w-full max-w-lg">
        <Icon className="w-10 h-10 text-gray-400 group-hover:text-blue-500 transition-colors mb-3" strokeWidth={1.5} />
        <p className="text-sm font-medium text-gray-700 mb-1">{title}</p>
        <p className="text-xs text-gray-500 mb-4">{description}</p>

        <form onSubmit={handleSubmit} className="w-full flex flex-col gap-1.5">
          <div className="flex gap-2">
            <label htmlFor={inputId} className="sr-only">
              URL
            </label>
            <input
              id={inputId}
              type="url"
              value={url}
              onChange={(e) => {
                setUrl(e.target.value);
                if (error) setError(null);
              }}
              placeholder="https://..."
              className={`flex-1 px-3 py-2 text-sm border rounded-md focus:outline-none focus:ring-1 ${
                error
                  ? 'border-red-400 focus:border-red-500 focus:ring-red-500'
                  : 'border-gray-300 focus:border-blue-500 focus:ring-blue-500'
              }`}
              required
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? errorId : undefined}
              onFocus={(e) => e.stopPropagation()}
              onKeyDown={(e) => e.stopPropagation()}
              onKeyUp={(e) => e.stopPropagation()}
              onKeyPress={(e) => e.stopPropagation()}
            />
            <button
              type="submit"
              className="px-4 py-2 text-sm font-medium text-white bg-blue-500 rounded-md hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            >
              Save
            </button>
          </div>
          {error && (
            <p id={errorId} role="alert" className="text-xs text-red-600">
              {error}
            </p>
          )}
        </form>
      </div>
    </div>
  );
}
