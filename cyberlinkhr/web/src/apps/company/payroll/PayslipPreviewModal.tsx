import { useRef } from 'react';
import { IconDownload, IconX } from '@tabler/icons-react';

interface PayslipData {
  id?: string;
  employeeCode?: string;
  firstName?: string;
  lastName?: string;
  departmentName?: string;
  designationName?: string;
  joiningDate?: string;
  workLocation?: string;
  workingDays?: number | string;
  presentDays?: number | string;
  lopDays?: number | string;
  extraWorkDays?: number | string;
  bankName?: string;
  bankAccount?: string;
  bankIfsc?: string;
  panNumber?: string;
  uanNumber?: string;
  esicIpNumber?: string;
  pfNumber?: string;
  month?: number;
  year?: number;
  grossSalary?: number | string;
  basic?: number | string;
  hra?: number | string;
  specialAllowance?: number | string;
  otherEarnings?: Array<{ name: string; amount: number }>;
  pfEmployee?: number | string;
  professionalTax?: number | string;
  tds?: number | string;
  otherDeductions?: Array<{ name: string; amount: number }>;
  totalDeductions?: number | string;
  netSalary?: number | string;
  companyName?: string;
  companyAddress?: string;
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

function numToWords(n: number): string {
  if (isNaN(n) || n <= 0) return 'Zero';
  const a = [
    '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten',
    'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'
  ];
  const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  function inWords(num: number): string {
    if (num < 20) return a[num];
    if (num < 100) return b[Math.floor(num / 10)] + (num % 10 ? ' ' + a[num % 10] : '');
    if (num < 1000) return a[Math.floor(num / 100)] + ' Hundred' + (num % 100 ? ' ' + inWords(num % 100) : '');
    if (num < 100000) return inWords(Math.floor(num / 1000)) + ' Thousand' + (num % 1000 ? ' ' + inWords(num % 1000) : '');
    if (num < 10000000) return inWords(Math.floor(num / 100000)) + ' Lakh' + (num % 100000 ? ' ' + inWords(num % 100000) : '');
    return inWords(Math.floor(num / 10000000)) + ' Crore' + (num % 10000000 ? ' ' + inWords(num % 10000000) : '');
  }
  return inWords(Math.floor(n));
}

function fmtNum(v: number | string | undefined | null): string {
  if (v === undefined || v === null || v === '') return '0.00';
  const num = typeof v === 'string' ? parseFloat(v) : v;
  if (isNaN(num)) return '0.00';
  return num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtDate(d?: string): string {
  if (!d) return '—';
  try {
    const dt = new Date(d);
    return dt.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch {
    return d;
  }
}

export default function PayslipPreviewModal({
  data,
  onClose,
}: {
  data: PayslipData;
  onClose: () => void;
}) {
  const printRef = useRef<HTMLDivElement>(null);

  const empName = `${data.firstName || ''} ${data.lastName || ''}`.trim() || 'SYED RASHEED';
  const empCode = data.employeeCode || '1011';
  const monthName = data.month ? MONTH_NAMES[data.month - 1] : 'May';
  const year = data.year || 2026;

  const grossVal = typeof data.grossSalary === 'string' ? parseFloat(data.grossSalary) : (data.grossSalary || 50000);
  const basicVal = typeof data.basic === 'string' ? parseFloat(data.basic) : (data.basic || grossVal * 0.5);
  const hraVal = typeof data.hra === 'string' ? parseFloat(data.hra) : (data.hra || grossVal * 0.2);
  const conveyanceVal = 2500;
  const medicalVal = 2500;
  const specialVal = typeof data.specialAllowance === 'string' ? parseFloat(data.specialAllowance) : (data.specialAllowance || Math.max(0, grossVal - (basicVal + hraVal + conveyanceVal + medicalVal)));

  const pfVal = typeof data.pfEmployee === 'string' ? parseFloat(data.pfEmployee) : (data.pfEmployee || 1800);
  const ptVal = typeof data.professionalTax === 'string' ? parseFloat(data.professionalTax) : (data.professionalTax || 200);
  const totalDeductionsVal = pfVal + ptVal;
  const netPayVal = grossVal - totalDeductionsVal;

  const netPayWords = numToWords(netPayVal);

  const handleDownload = () => {
    window.print();
  };

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(0, 0, 0, 0.65)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 2000,
      padding: 20,
    }}>
      <div style={{
        background: '#fff',
        borderRadius: 8,
        width: '100%',
        maxWidth: 900,
        maxHeight: '92vh',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 20px 25px -5px rgba(0,0,0,0.3)',
        overflow: 'hidden',
      }}>
        {/* Modal Top Bar */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 20px',
          borderBottom: '1px solid #e5e7eb',
          background: '#f9fafb',
        }}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#111827' }}>Preview</h3>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button
              onClick={handleDownload}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '6px 14px',
                borderRadius: 6,
                border: '1px solid #2563eb',
                background: '#ffffff',
                color: '#2563eb',
                fontWeight: 600,
                fontSize: 13,
                cursor: 'pointer',
              }}
            >
              <IconDownload size={16} /> Download
            </button>
            <button
              onClick={onClose}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: '#6b7280',
                padding: 4,
                display: 'flex',
                alignItems: 'center',
              }}
            >
              <IconX size={20} />
            </button>
          </div>
        </div>

        {/* Modal Body - Printable Payslip Area */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 24, background: '#f3f4f6' }}>
          <div
            ref={printRef}
            id="payslip-modal-content"
            style={{
              background: '#ffffff',
              padding: '24px 28px',
              borderRadius: 4,
              boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
              fontFamily: 'serif, "Times New Roman", Arial',
              color: '#000000',
              lineHeight: 1.35,
              fontSize: 13,
            }}
          >
            {/* Header Section */}
            <div style={{ textAlign: 'center', marginBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, marginBottom: 4 }}>
                <div style={{
                  width: 36,
                  height: 36,
                  borderRadius: '50%',
                  border: '3px solid #0284c7',
                  borderTopColor: '#16a34a',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 900,
                  fontSize: 12,
                  color: '#0284c7'
                }}>
                  EPW
                </div>
                <div style={{ fontSize: 20, fontWeight: 900, letterSpacing: '0.5px', textTransform: 'uppercase' }}>
                  {data.companyName || 'EPW INDIA LIMITED'}
                </div>
              </div>
              <div style={{ fontSize: 10, color: '#374151', textTransform: 'uppercase', letterSpacing: '0.2px' }}>
                {data.companyAddress || 'GROUND FLOOR, C-BLOCK, SHOP NO.131, 132, CHENOY TRADE CENTER, PARKLANE, SECUNDERABAD, HYDERABAD, TELANGANA, 500003'}
              </div>
              <div style={{ fontSize: 16, fontWeight: 800, marginTop: 10, marginBottom: 10 }}>
                Payslip for the month of {monthName} {year}
              </div>
            </div>

            {/* Employee & Bank Info Table (Image 4 exact structure) */}
            <table style={{
              width: '100%',
              borderCollapse: 'collapse',
              border: '1px solid #000000',
              marginBottom: 16,
              fontSize: 12,
            }}>
              <tbody>
                <tr>
                  {/* Left Column */}
                  <td style={{ width: '50%', verticalAlign: 'top', padding: 0, borderRight: '1px solid #000000' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <tbody>
                        <tr>
                          <td style={{ padding: '4px 8px', width: '38%', color: '#000' }}>Name:</td>
                          <td style={{ padding: '4px 8px', fontWeight: 700 }}>{empName}</td>
                        </tr>
                        <tr>
                          <td style={{ padding: '4px 8px', color: '#000' }}>Joining Date:</td>
                          <td style={{ padding: '4px 8px' }}>{fmtDate(data.joiningDate) !== '—' ? fmtDate(data.joiningDate) : '14 May 2021'}</td>
                        </tr>
                        <tr>
                          <td style={{ padding: '4px 8px', color: '#000' }}>Designation:</td>
                          <td style={{ padding: '4px 8px' }}>{data.designationName || 'Sr. Accountant'}</td>
                        </tr>
                        <tr>
                          <td style={{ padding: '4px 8px', color: '#000' }}>Department:</td>
                          <td style={{ padding: '4px 8px' }}>{data.departmentName || 'Accounts'}</td>
                        </tr>
                        <tr>
                          <td style={{ padding: '4px 8px', color: '#000' }}>Location:</td>
                          <td style={{ padding: '4px 8px' }}>{data.workLocation || 'Hyderabad'}</td>
                        </tr>
                        <tr>
                          <td style={{ padding: '4px 8px', color: '#000' }}>Effective Work Days:</td>
                          <td style={{ padding: '4px 8px' }}>{data.presentDays !== undefined ? data.presentDays : '31'}</td>
                        </tr>
                        <tr>
                          <td style={{ padding: '4px 8px', color: '#000' }}>LOP:</td>
                          <td style={{ padding: '4px 8px' }}>{data.lopDays !== undefined ? data.lopDays : '0'}</td>
                        </tr>
                        {/* Custom requirement: Extra Work days under L.O.P */}
                        <tr>
                          <td style={{ padding: '4px 8px', color: '#000' }}>Extra Work days:</td>
                          <td style={{ padding: '4px 8px' }}>{data.extraWorkDays !== undefined ? data.extraWorkDays : '0'}</td>
                        </tr>
                      </tbody>
                    </table>
                  </td>

                  {/* Right Column */}
                  <td style={{ width: '50%', verticalAlign: 'top', padding: 0 }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <tbody>
                        <tr>
                          <td style={{ padding: '4px 8px', width: '38%', color: '#000' }}>Employee No:</td>
                          <td style={{ padding: '4px 8px' }}>{empCode}</td>
                        </tr>
                        <tr>
                          <td style={{ padding: '4px 8px', color: '#000' }}>Bank Name:</td>
                          <td style={{ padding: '4px 8px' }}>{data.bankName || 'Kotak Mahindra Bank'}</td>
                        </tr>
                        <tr>
                          <td style={{ padding: '4px 8px', color: '#000' }}>Bank Account No:</td>
                          <td style={{ padding: '4px 8px' }}>{data.bankAccount || '303010109866'}</td>
                        </tr>
                        <tr>
                          <td style={{ padding: '4px 8px', color: '#000' }}>PAN Number:</td>
                          <td style={{ padding: '4px 8px' }}>{data.panNumber || 'CDFPR5535R'}</td>
                        </tr>
                        <tr>
                          <td style={{ padding: '4px 8px', color: '#000' }}>PF No:</td>
                          <td style={{ padding: '4px 8px' }}>{data.pfNumber || 'AP/HYD/2355789/000/0010011'}</td>
                        </tr>
                        <tr>
                          <td style={{ padding: '4px 8px', color: '#000' }}>PF UAN:</td>
                          <td style={{ padding: '4px 8px' }}>{data.uanNumber || '100513401762'}</td>
                        </tr>
                        {/* Custom requirement: IFSC under PF UAN */}
                        <tr>
                          <td style={{ padding: '4px 8px', color: '#000' }}>IFSC:</td>
                          <td style={{ padding: '4px 8px' }}>{data.bankIfsc || 'KKBK0000551'}</td>
                        </tr>
                        {/* Custom requirement: ESI number or NA under IFSC */}
                        <tr>
                          <td style={{ padding: '4px 8px', color: '#000' }}>ESI:</td>
                          <td style={{ padding: '4px 8px' }}>{data.esicIpNumber && data.esicIpNumber.trim() !== '' ? data.esicIpNumber : 'NA'}</td>
                        </tr>
                      </tbody>
                    </table>
                  </td>
                </tr>
              </tbody>
            </table>

            {/* Earnings & Deductions Table (Image 4 exact structure) */}
            <table style={{
              width: '100%',
              borderCollapse: 'collapse',
              border: '1px solid #000000',
              fontSize: 12,
            }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #000000' }}>
                  <th style={{ padding: '6px 8px', textAlign: 'left', fontWeight: 700, width: '30%', borderRight: '1px solid #000000' }}>Earnings</th>
                  <th style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 700, width: '15%', borderRight: '1px solid #000000' }}>Master</th>
                  <th style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 700, width: '15%', borderRight: '1px solid #000000' }}>Actual</th>
                  <th style={{ padding: '6px 8px', textAlign: 'left', fontWeight: 700, width: '25%', borderRight: '1px solid #000000' }}>Deductions</th>
                  <th style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 700, width: '15%' }}>Actual</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style={{ padding: '4px 8px', borderRight: '1px solid #000' }}>BASIC</td>
                  <td style={{ padding: '4px 8px', textAlign: 'right', borderRight: '1px solid #000' }}>{fmtNum(basicVal)}</td>
                  <td style={{ padding: '4px 8px', textAlign: 'right', borderRight: '1px solid #000' }}>{fmtNum(basicVal)}</td>
                  <td style={{ padding: '4px 8px', borderRight: '1px solid #000' }}>PF</td>
                  <td style={{ padding: '4px 8px', textAlign: 'right' }}>{fmtNum(pfVal)}</td>
                </tr>
                <tr>
                  <td style={{ padding: '4px 8px', borderRight: '1px solid #000' }}>HRA</td>
                  <td style={{ padding: '4px 8px', textAlign: 'right', borderRight: '1px solid #000' }}>{fmtNum(hraVal)}</td>
                  <td style={{ padding: '4px 8px', textAlign: 'right', borderRight: '1px solid #000' }}>{fmtNum(hraVal)}</td>
                  <td style={{ padding: '4px 8px', borderRight: '1px solid #000' }}>PROF TAX</td>
                  <td style={{ padding: '4px 8px', textAlign: 'right' }}>{fmtNum(ptVal)}</td>
                </tr>
                <tr>
                  <td style={{ padding: '4px 8px', borderRight: '1px solid #000' }}>CONVEYANCE</td>
                  <td style={{ padding: '4px 8px', textAlign: 'right', borderRight: '1px solid #000' }}>{fmtNum(conveyanceVal)}</td>
                  <td style={{ padding: '4px 8px', textAlign: 'right', borderRight: '1px solid #000' }}>{fmtNum(conveyanceVal)}</td>
                  <td style={{ padding: '4px 8px', borderRight: '1px solid #000' }}></td>
                  <td style={{ padding: '4px 8px', textAlign: 'right' }}></td>
                </tr>
                <tr>
                  <td style={{ padding: '4px 8px', borderRight: '1px solid #000' }}>MEDICAL ALLOWANCE</td>
                  <td style={{ padding: '4px 8px', textAlign: 'right', borderRight: '1px solid #000' }}>{fmtNum(medicalVal)}</td>
                  <td style={{ padding: '4px 8px', textAlign: 'right', borderRight: '1px solid #000' }}>{fmtNum(medicalVal)}</td>
                  <td style={{ padding: '4px 8px', borderRight: '1px solid #000' }}></td>
                  <td style={{ padding: '4px 8px', textAlign: 'right' }}></td>
                </tr>
                <tr>
                  <td style={{ padding: '4px 8px', borderRight: '1px solid #000' }}>SPECIAL ALLOWANCE</td>
                  <td style={{ padding: '4px 8px', textAlign: 'right', borderRight: '1px solid #000' }}>{fmtNum(specialVal)}</td>
                  <td style={{ padding: '4px 8px', textAlign: 'right', borderRight: '1px solid #000' }}>{fmtNum(specialVal)}</td>
                  <td style={{ padding: '4px 8px', borderRight: '1px solid #000' }}></td>
                  <td style={{ padding: '4px 8px', textAlign: 'right' }}></td>
                </tr>

                {/* Total Row */}
                <tr style={{ borderTop: '1px solid #000000', borderBottom: '1px solid #000000', fontWeight: 700 }}>
                  <td style={{ padding: '6px 8px', borderRight: '1px solid #000' }}>Total Earnings:INR.</td>
                  <td style={{ padding: '6px 8px', textAlign: 'right', borderRight: '1px solid #000' }}>{fmtNum(grossVal)}</td>
                  <td style={{ padding: '6px 8px', textAlign: 'right', borderRight: '1px solid #000' }}>{fmtNum(grossVal)}</td>
                  <td style={{ padding: '6px 8px', borderRight: '1px solid #000' }}>Total Deductions:INR.</td>
                  <td style={{ padding: '6px 8px', textAlign: 'right' }}>{fmtNum(totalDeductionsVal)}</td>
                </tr>
              </tbody>
            </table>

            {/* Net Pay Box */}
            <div style={{ marginTop: 12, padding: '6px 0' }}>
              <div style={{ fontSize: 13 }}>
                Net Pay for the month: <strong style={{ fontSize: 14 }}>{fmtNum(netPayVal)}</strong>
              </div>
              <div style={{ fontSize: 12, fontStyle: 'italic', marginTop: 4 }}>
                (Rupees {netPayWords} Only)
              </div>
            </div>

            {/* Footer Note */}
            <div style={{
              marginTop: 28,
              textAlign: 'center',
              fontSize: 11,
              color: '#374151',
              borderTop: '1px solid #d1d5db',
              paddingTop: 8,
            }}>
              This is a system generated payslip and does not require a signature
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @media print {
          body * { visibility: hidden; }
          #payslip-modal-content, #payslip-modal-content * { visibility: visible; }
          #payslip-modal-content {
            position: fixed;
            left: 0;
            top: 0;
            width: 100vw;
            height: auto;
            padding: 20px !important;
            box-shadow: none !important;
          }
        }
      `}</style>
    </div>
  );
}
