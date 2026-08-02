import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import { IconExternalLink } from '@tabler/icons-react';
import Input from './Input';
import Select from './Select';
import Button from './Button';
import api from '@/lib/api';
import { FieldConfig } from '@/modules/field_config';

interface FormRendererProps {
  fields: FieldConfig[];
  initialValues?: any;
  onSubmit: (data: any) => void;
  isReadOnly?: boolean;
  submitLabel?: string;
  loading?: boolean;
  module?: string;
}

export default function FormRenderer({
  fields,
  initialValues = {},
  onSubmit,
  isReadOnly = false,
  submitLabel = 'Save',
  loading = false,
  module,
}: FormRendererProps) {
  const { register, handleSubmit, watch, setValue, formState: { errors }, reset } = useForm({
    defaultValues: initialValues,
  });

  const formValues = watch();
  const [allFields, setAllFields] = useState<FieldConfig[]>(fields);

  useEffect(() => {
    reset(initialValues);
  }, [initialValues, reset]);

  useEffect(() => {
    if (!module) {
      setAllFields(fields);
      return;
    }
    api.get(`/framework/customisation/fields/${module}`)
      .then((res) => {
        const custom = res.data.data || [];
        const mappedCustom = custom.map((c: any) => ({
          name: c.fieldName,
          label: c.label,
          type: c.fieldType,
          required: c.required,
          options: c.options || [],
        }));
        setAllFields([...fields, ...mappedCustom]);
      })
      .catch(console.error);
  }, [fields, module]);

  return (
    <form onSubmit={handleSubmit(onSubmit)} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        {allFields.map((field) => {
          // Check conditional visibility
          if (field.dependsOn && !field.dependsOn(formValues)) {
            return null;
          }

          const error = errors[field.name]?.message as string | undefined;

          if (isReadOnly) {
            let displayValue = formValues[field.name] ?? '—';
            if (field.type === 'boolean') displayValue = formValues[field.name] ? 'Yes' : 'No';
            return (
              <div key={field.name} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span className="form-label" style={{ color: 'var(--text-3)' }}>{field.label}</span>
                <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-1)' }}>{String(displayValue)}</span>
              </div>
            );
          }

          switch (field.type) {
            case 'boolean':
              return (
                <div key={field.name} style={{ display: 'flex', alignItems: 'center', gap: 8, height: '100%', paddingTop: 20 }}>
                  <input
                    type="checkbox"
                    id={field.name}
                    {...register(field.name)}
                    style={{ width: 16, height: 16, cursor: 'pointer' }}
                  />
                  <label htmlFor={field.name} style={{ fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>
                    {field.label}
                  </label>
                </div>
              );

            case 'select':
              const selectOptions = (field.options || []).map((o) =>
                typeof o === 'string' ? { value: o, label: o } : o
              );
              return (
                <Select
                  key={field.name}
                  label={field.label}
                  required={field.required}
                  error={error}
                  options={selectOptions}
                  {...register(field.name, { required: field.required ? 'Required' : false })}
                />
              );

            case 'link':
              return (
                <LinkSelect
                  key={field.name}
                  field={field}
                  value={formValues[field.name]}
                  onChange={(val) => setValue(field.name, val)}
                  error={error}
                  required={field.required}
                />
              );

            case 'textarea':
              return (
                <div key={field.name} style={{ display: 'flex', flexDirection: 'column', gap: 4, gridColumn: 'span 2' }}>
                  <label className="form-label">
                    {field.label}
                    {field.required && <span style={{ color: 'var(--danger)', marginLeft: 2 }}>*</span>}
                  </label>
                  <textarea
                    style={{
                      border: `1px solid ${error ? 'var(--danger)' : 'var(--border)'}`,
                      borderRadius: 'var(--input-radius)',
                      padding: '6px 10px',
                      fontSize: 13,
                      fontFamily: 'inherit',
                      color: 'var(--text-1)',
                      background: 'var(--bg-surface)',
                      outline: 'none',
                      minHeight: 80,
                    }}
                    {...register(field.name, { required: field.required ? 'Required' : false })}
                  />
                  {error && <span style={{ fontSize: 11, color: 'var(--danger)' }}>{error}</span>}
                </div>
              );

            case 'number':
              return (
                <Input
                  key={field.name}
                  type="number"
                  label={field.label}
                  required={field.required}
                  error={error}
                  {...register(field.name, {
                    required: field.required ? 'Required' : false,
                    valueAsNumber: true,
                  })}
                />
              );

            case 'date':
              return (
                <Input
                  key={field.name}
                  type="date"
                  label={field.label}
                  required={field.required}
                  error={error}
                  {...register(field.name, { required: field.required ? 'Required' : false })}
                />
              );

            default:
              return (
                <Input
                  key={field.name}
                  type="text"
                  label={field.label}
                  required={field.required}
                  error={error}
                  {...register(field.name, { required: field.required ? 'Required' : false })}
                />
              );
          }
        })}
      </div>

      {!isReadOnly && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
          <Button type="submit" variant="primary" loading={loading}>
            {submitLabel}
          </Button>
        </div>
      )}
    </form>
  );
}

// Searchable Link dropdown fetching list dynamically from backend
function LinkSelect({
  field,
  value,
  onChange,
  error,
  required,
}: {
  field: FieldConfig;
  value: string;
  onChange: (val: string) => void;
  error?: string;
  required?: boolean;
}) {
  const [options, setOptions] = useState<{ value: string; label: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const navigate = useNavigate();

  const getDestinationPath = () => {
    if (!value) return null;
    const doctype = field.linkDoctype;
    if (doctype === 'Employee') return `/employees/${value}`;
    if (doctype === 'Department') return `/departments`;
    if (doctype === 'Designation') return `/designations`;
    if (doctype === 'LeaveType') return `/leave-types`;
    if (doctype === 'Shift') return `/shifts`;
    if (doctype === 'SalaryStructure') return `/salary-structure`;
    return null;
  };

  useEffect(() => {
    setLoading(true);
    const params = field.linkDoctype 
      ? { doctype: field.linkDoctype, q: search }
      : {};
    
    const url = field.linkDoctype 
      ? '/framework/link-search' 
      : (field.linkUrl || '');

    if (!url) return;

    api.get(url, { params })
      .then((res) => {
        const list = res.data.data || [];
        setOptions(
          list.map((item: any) => ({
            value: item.id,
            label: item.label || item.name || item.title || item.employeeCode || item.id,
          }))
        );
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [field.linkUrl, field.linkDoctype, search]);

  const selectedOption = options.find(o => o.value === value);
  const destPath = getDestinationPath();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, position: 'relative' }}>
      <label className="form-label" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span>
          {field.label}
          {required && <span style={{ color: 'var(--danger)', marginLeft: 2 }}>*</span>}
        </span>
        {destPath && (
          <button
            type="button"
            onClick={() => navigate(destPath)}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--brand)',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              fontSize: 11,
              fontWeight: 600,
              padding: 0
            }}
          >
            <IconExternalLink size={12} /> Go to link
          </button>
        )}
      </label>

      <div style={{ position: 'relative' }}>
        <input
          type="text"
          value={isOpen ? search : (selectedOption?.label || '')}
          onChange={(e) => {
            setSearch(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => {
            setIsOpen(true);
            setSearch('');
          }}
          onBlur={() => {
            setTimeout(() => setIsOpen(false), 200);
          }}
          placeholder={loading ? 'Searching...' : `Search ${field.label}...`}
          style={{
            border: `1px solid ${error ? 'var(--danger)' : 'var(--border)'}`,
            borderRadius: 'var(--input-radius)',
            padding: '6px 10px',
            fontSize: 13,
            color: 'var(--text-1)',
            background: 'var(--bg-surface)',
            width: '100%',
            outline: 'none',
          }}
        />

        {isOpen && options.length > 0 && (
          <div style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            right: 0,
            background: 'var(--bg-surface)',
            border: '1px solid var(--border)',
            borderRadius: 6,
            boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
            zIndex: 10,
            maxHeight: 180,
            overflowY: 'auto',
            marginTop: 4
          }}>
            {options.map((opt) => (
              <div
                key={opt.value}
                onMouseDown={() => {
                  onChange(opt.value);
                  setSearch('');
                  setIsOpen(false);
                }}
                style={{
                  padding: '8px 12px',
                  fontSize: 12.5,
                  cursor: 'pointer',
                  background: value === opt.value ? 'var(--bg-subtle)' : 'transparent',
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-subtle)'}
                onMouseLeave={(e) => {
                  if (value !== opt.value) e.currentTarget.style.background = '';
                }}
              >
                {opt.label}
              </div>
            ))}
          </div>
        )}
      </div>
      {error && <span style={{ fontSize: 11, color: 'var(--danger)' }}>{error}</span>}
    </div>
  );
}
