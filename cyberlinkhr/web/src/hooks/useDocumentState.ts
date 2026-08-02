import { useEffect, useState, useRef } from 'react';

export function useDocumentState(
  module: string,
  id: string | undefined, // undefined for new docs
  initialData: any,
  onSave: (data: any) => Promise<any>
) {
  const [mode, setMode] = useState<'read' | 'write'>(id ? 'read' : 'write');
  const [data, setData] = useState<any>(initialData || {});
  const [isDirty, setIsDirty] = useState(false);
  const [docStatus, setDocStatus] = useState<'DRAFT' | 'SAVED' | 'SUBMITTED' | 'CANCELLED'>(
    initialData?.docStatus || 'DRAFT'
  );

  const originalDataRef = useRef<any>(initialData || {});

  useEffect(() => {
    if (initialData) {
      setData(initialData);
      originalDataRef.current = initialData;
      setDocStatus(initialData.docStatus || (id ? 'SAVED' : 'DRAFT'));
    }
  }, [initialData, id]);

  // Load from localStorage if draft exists
  useEffect(() => {
    if (!id) {
      const draft = localStorage.getItem(`draft_${module}_new`);
      if (draft) {
        try {
          setData(JSON.parse(draft));
          setIsDirty(true);
        } catch (e) {
          console.error(e);
        }
      }
    } else {
      const draft = localStorage.getItem(`draft_${module}_${id}`);
      if (draft) {
        try {
          setData(JSON.parse(draft));
          setIsDirty(true);
          setMode('write');
        } catch (e) {
          console.error(e);
        }
      }
    }
  }, [id, module]);

  // Periodic autosave to localStorage every 30 seconds
  useEffect(() => {
    if (!isDirty || docStatus === 'SUBMITTED' || docStatus === 'CANCELLED') return;
    const interval = setInterval(() => {
      const key = id ? `draft_${module}_${id}` : `draft_${module}_new`;
      localStorage.setItem(key, JSON.stringify(data));
    }, 30000);
    return () => clearInterval(interval);
  }, [data, isDirty, id, module, docStatus]);

  // Unsaved changes warning
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isDirty) {
        e.preventDefault();
        e.returnValue = 'You have unsaved changes. Leave?';
        return e.returnValue;
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isDirty]);

  const updateField = (name: string, value: any) => {
    setData((prev: any) => ({ ...prev, [name]: value }));
    setIsDirty(true);
  };

  const handleSave = async () => {
    try {
      const saved = await onSave(data);
      originalDataRef.current = saved;
      setData(saved);
      setIsDirty(false);
      setDocStatus(saved.docStatus || 'SAVED');
      setMode('read');
      const key = id ? `draft_${module}_${id}` : `draft_${module}_new`;
      localStorage.removeItem(key);
      return saved;
    } catch (e) {
      console.error(e);
      throw e;
    }
  };

  const handleDiscard = () => {
    setData(originalDataRef.current);
    setIsDirty(false);
    setMode('read');
    const key = id ? `draft_${module}_${id}` : `draft_${module}_new`;
    localStorage.removeItem(key);
  };

  return {
    mode,
    setMode,
    data,
    setData,
    isDirty,
    docStatus,
    setDocStatus,
    updateField,
    handleSave,
    handleDiscard,
  };
}
export default useDocumentState;
