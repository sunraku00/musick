import React, { useEffect, useState } from 'react';

interface SearchBarProps {
  onSearch: (query: string) => void;
  isLoading: boolean;
}

export const SearchBar: React.FC<SearchBarProps> = ({ onSearch, isLoading }) => {
  const [inputValue, setInputValue] = useState('');

  // Debounce 400ms sesuai PRD F1
  useEffect(() => {
    const handler = setTimeout(() => {
      const trimmed = inputValue.trim();
      if (trimmed.length > 0) {
        onSearch(trimmed);
      }
    }, 400);

    return () => clearTimeout(handler);
  }, [inputValue, onSearch]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value);
  };

  const handleClear = () => {
    setInputValue('');
  };

  return (
    <div className="search-bar-container">
      <div className="search-input-wrapper">
        <input
          type="text"
          className="search-input"
          placeholder="Cari lagu, artis, atau album..."
          value={inputValue}
          onChange={handleChange}
          aria-label="Cari musik"
        />
        {inputValue && (
          <button
            type="button"
            className="clear-button"
            onClick={handleClear}
            title="Bersihkan pencarian"
          >
            ✕
          </button>
        )}
      </div>
      {isLoading && <span className="loading-badge">Memuat...</span>}
    </div>
  );
};
