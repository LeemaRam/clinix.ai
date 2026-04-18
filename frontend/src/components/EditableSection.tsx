import React, { useState, useRef, useEffect } from 'react';
import { Edit2, Save, X, CheckCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface EditableSectionProps {
  title: string;
  content: string;
  isEditing: boolean;
  onEdit: () => void;
  onSave: () => void;
  onCancel: () => void;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  minHeight?: string;
}

const EditableSection: React.FC<EditableSectionProps> = ({
  title,
  content,
  isEditing,
  onEdit,
  onSave,
  onCancel,
  onChange,
  placeholder,
  className = '',
  minHeight = '120px'
}) => {
  const { t } = useTranslation();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [localContent, setLocalContent] = useState(content);

  // Update local content when prop changes
  useEffect(() => {
    setLocalContent(content);
  }, [content]);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current && isEditing) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [localContent, isEditing]);

  // Focus textarea when editing starts
  useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.focus();
      // Place cursor at end
      const length = textareaRef.current.value.length;
      textareaRef.current.setSelectionRange(length, length);
    }
  }, [isEditing]);

  const handleLocalChange = (value: string) => {
    setLocalContent(value);
    onChange(value);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onCancel();
    } else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      onSave();
    }
  };

  return (
    <div className={`border border-gray-200 rounded-lg overflow-hidden ${className}`}>
      <div className="bg-gray-50 px-4 py-3 flex justify-between items-center border-b border-gray-200">
        <h4 className="font-medium text-gray-800">{title}</h4>
        <div className="flex items-center space-x-2">
          {isEditing ? (
            <>
              <button
                onClick={onCancel}
                className="text-gray-500 hover:text-gray-700 p-1 rounded transition-colors"
                title={t('common.cancel')}
              >
                <X size={16} />
              </button>
              <button
                onClick={onSave}
                className="text-green-600 hover:text-green-700 p-1 rounded transition-colors"
                title={`${t('common.save')} (Ctrl+Enter)`}
              >
                <CheckCircle size={16} />
              </button>
            </>
          ) : (
            <button
              onClick={onEdit}
              className="text-blue-600 hover:text-blue-700 p-1 rounded transition-colors"
              title={t('reports.editSection')}
            >
              <Edit2 size={16} />
            </button>
          )}
        </div>
      </div>
      <div className="p-4">
        {isEditing ? (
          <div className="relative">
            <textarea
              ref={textareaRef}
              value={localContent}
              onChange={(e) => handleLocalChange(e.target.value)}
              onKeyDown={handleKeyDown}
              className="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none transition-all"
              placeholder={placeholder || t('reports.enterContent')}
              style={{ minHeight }}
            />
            <div className="text-xs text-gray-400 mt-2 flex justify-between">
              <span>{t('reports.editingHint')}</span>
              <span>{localContent.length} {t('reports.characters')}</span>
            </div>
          </div>
        ) : (
          <div 
            className="whitespace-pre-wrap text-gray-700 cursor-pointer hover:bg-gray-50 rounded p-2 transition-colors"
            style={{ minHeight: '60px' }}
            onClick={onEdit}
          >
            {content || (
              <span className="text-gray-400 italic">{t('reports.noContentAvailable')}</span>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default EditableSection; 