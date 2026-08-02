export interface FieldConfig {
  name: string;
  label: string;
  type: 'text' | 'number' | 'date' | 'select' | 'boolean' | 'file' | 'textarea' | 'link';
  required?: boolean;
  options?: { value: string; label: string }[] | string[];
  dependsOn?: (values: any) => boolean;
  linkUrl?: string; // For API searchable link dropdowns
}

export const FIELD_CONFIGS: Record<string, FieldConfig[]> = {
  employee: [
    { name: 'firstName', label: 'First Name', type: 'text', required: true },
    { name: 'lastName', label: 'Last Name', type: 'text', required: true },
    { name: 'email', label: 'Email Address', type: 'text', required: true },
    { name: 'phone', label: 'Phone Number', type: 'text' },
    { name: 'dob', label: 'Date of Birth', type: 'date' },
    { name: 'gender', label: 'Gender', type: 'select', options: ['MALE', 'FEMALE', 'OTHER'] },
    { name: 'departmentId', label: 'Department', type: 'link', linkUrl: '/departments' },
    { name: 'designationId', label: 'Designation', type: 'link', linkUrl: '/designations' },
    { name: 'joiningDate', label: 'Joining Date', type: 'date', required: true },
    { name: 'employmentType', label: 'Employment Type', type: 'select', options: ['FULL_TIME', 'PART_TIME', 'CONTRACT', 'INTERN'] },
    { name: 'uanNumber', label: 'UAN Number', type: 'text' },
    { name: 'panNumber', label: 'PAN Number', type: 'text' },
    { name: 'aadhaarNumber', label: 'Aadhaar Number', type: 'text' },
  ],
  asset: [
    { name: 'name', label: 'Asset Name', type: 'text', required: true },
    { name: 'category', label: 'Category', type: 'select', options: ['LAPTOP', 'PHONE', 'HEADSET', 'VEHICLE', 'FURNITURE', 'MONITOR', 'OTHER'], required: true },
    { name: 'brand', label: 'Brand', type: 'text' },
    { name: 'serialNumber', label: 'Serial Number', type: 'text' },
    { name: 'purchaseDate', label: 'Purchase Date', type: 'date' },
    { name: 'purchaseValue', label: 'Purchase Value', type: 'number' },
  ],
  leave_request: [
    { name: 'leaveTypeId', label: 'Leave Type', type: 'link', linkUrl: '/leave/types', required: true },
    { name: 'startDate', label: 'Start Date', type: 'date', required: true },
    { name: 'endDate', label: 'End Date', type: 'date', required: true },
    { name: 'isHalfDay', label: 'Is Half Day', type: 'boolean' },
    { name: 'halfDaySession', label: 'Half Day Session', type: 'select', options: ['AM', 'PM'], dependsOn: (values) => !!values.isHalfDay },
    { name: 'reason', label: 'Reason', type: 'textarea' },
  ],
  grievance: [
    { name: 'title', label: 'Title', type: 'text', required: true },
    { name: 'description', label: 'Description', type: 'textarea', required: true },
    { name: 'anonymous', label: 'Submit Anonymously', type: 'boolean' },
  ]
};
