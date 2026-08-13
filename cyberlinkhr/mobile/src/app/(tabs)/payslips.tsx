import { useState } from 'react';
import { StyleSheet, Text, View, ScrollView, TouchableOpacity, SafeAreaView, ActivityIndicator, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import api from '../../lib/api';

const f = (n: any) => {
  return '₹' + Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 });
};

function buildPayslipHtml(ps: any, employee: any): string {
  const monthLabel = new Date(ps.year, ps.month - 1).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
  const name = employee ? `${employee.firstName} ${employee.lastName || ''}`.trim() : 'Employee';
  const empCode = employee?.employeeCode || 'EMP-001';
  const dept = employee?.department?.name || 'Engineer Team';
  const designation = employee?.designation || 'Software Engineer';

  return `
    <html>
      <head>
        <style>
          body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; padding: 30px; color: #1e293b; }
          .header { text-align: center; border-bottom: 2px solid #e2e8f0; padding-bottom: 20px; margin-bottom: 25px; }
          .company-name { font-size: 24px; font-weight: 800; color: #2563eb; }
          .title { font-size: 16px; color: #64748b; margin-top: 5px; text-transform: uppercase; letter-spacing: 1px; }
          .meta-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 30px; background: #f8fafc; padding: 15px; border-radius: 8px; border: 1px solid #f1f5f9; }
          .meta-item { font-size: 13px; }
          .meta-item strong { color: #475569; }
          .payslip-month { text-align: center; font-size: 18px; font-weight: 700; color: #0f172a; margin-bottom: 25px; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 30px; }
          th, td { padding: 12px 15px; text-align: left; font-size: 14px; }
          th { background-color: #f1f5f9; color: #475569; font-weight: 700; border-bottom: 2px solid #e2e8f0; }
          td { border-bottom: 1px solid #f1f5f9; }
          .deduction { color: #ef4444; }
          .total-row { font-weight: 800; font-size: 16px; background-color: #f8fafc; border-top: 2px solid #e2e8f0; }
          .net-salary { text-align: center; background: #eff6ff; padding: 20px; border-radius: 8px; border: 1px solid #bfdbfe; margin-top: 10px; }
          .net-val { font-size: 28px; font-weight: 800; color: #2563eb; margin-top: 5px; }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="company-name">Cyberlink Technologies</div>
          <div class="title">Salary Slip / Payslip</div>
        </div>
        <div class="payslip-month">For the month of ${monthLabel}</div>
        <div class="meta-grid">
          <div class="meta-item"><strong>Employee Name:</strong> ${name}</div>
          <div class="meta-item"><strong>Employee ID:</strong> ${empCode}</div>
          <div class="meta-item"><strong>Department:</strong> ${dept}</div>
          <div class="meta-item"><strong>Designation:</strong> ${designation}</div>
        </div>
        <table>
          <thead>
            <tr>
              <th>Salary Component</th>
              <th>Earnings</th>
              <th>Deductions</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Basic Salary</td>
              <td>${f(ps.basicSalary)}</td>
              <td>—</td>
            </tr>
            <tr>
              <td>House Rent Allowance (HRA)</td>
              <td>${f(ps.hra)}</td>
              <td>—</td>
            </tr>
            <tr>
              <td>Other Allowances</td>
              <td>${f(ps.allowances)}</td>
              <td>—</td>
            </tr>
            <tr>
              <td>Provident Fund (PF)</td>
              <td>—</td>
              <td class="deduction">${f(ps.pfDeduction)}</td>
            </tr>
            <tr>
              <td>Tax Deducted at Source (TDS)</td>
              <td>—</td>
              <td class="deduction">${f(ps.tds)}</td>
            </tr>
            <tr class="total-row">
              <td>Total</td>
              <td>${f(Number(ps.basicSalary) + Number(ps.hra) + Number(ps.allowances))}</td>
              <td class="deduction">${f(Number(ps.pfDeduction) + Number(ps.tds))}</td>
            </tr>
          </tbody>
        </table>
        <div class="net-salary">
          <div>NET TAKE-HOME SALARY</div>
          <div class="net-val">${f(ps.netSalary)}</div>
        </div>
      </body>
    </html>
  `;
}

export default function PayslipsScreen() {
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [downloading, setDownloading] = useState(false);

  // Fetch employee profile
  const { data: me } = useQuery<any>({
    queryKey: ['my-employee-profile'],
    queryFn: () => api.get('/api/employees/me').then(r => r.data.data),
  });

  // Fetch payslips
  const { data: payslips = [], isLoading: loadingPayslips } = useQuery<any[]>({
    queryKey: ['payslips-screen'],
    queryFn: () => api.get('/api/payroll/my-payslips').then(r => r.data.data || []),
  });

  const activeSlip = payslips[selectedIdx];
  const name = me ? `${me.firstName} ${me.lastName || ''}`.trim() : 'Employee';
  const empCode = me?.employeeCode || 'EMP-001';
  const dept = me?.department?.name || 'Engineer Team';

  const handleDownload = async () => {
    if (!activeSlip) return;
    setDownloading(true);
    try {
      const html = buildPayslipHtml(activeSlip, me);
      const { uri } = await Print.printToFileAsync({ html });
      await Sharing.shareAsync(uri);
    } catch {
      Alert.alert('Error', 'Failed to generate and share PDF payslip');
    } finally {
      setDownloading(false);
    }
  };

  const getMonthName = (monthNum: number, yearNum: number) => {
    try {
      return new Date(yearNum, monthNum - 1).toLocaleDateString('en-IN', {
        month: 'long',
        year: 'numeric',
      });
    } catch {
      return `Month ${monthNum}, ${yearNum}`;
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Payslips</Text>
        <Text style={styles.headerSubtitle}>
          {empCode} • {name} • {dept}
        </Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {loadingPayslips ? (
          <ActivityIndicator color="#2563eb" style={{ marginVertical: 30 }} />
        ) : activeSlip ? (
          <>
            {/* LATEST SELECTED DETAILS CARD */}
            <Text style={styles.sectionTitle}>
              LATEST — {getMonthName(activeSlip.month, activeSlip.year).toUpperCase()}
            </Text>

            <View style={styles.detailsCard}>
              <View style={styles.netRow}>
                <View>
                  <Text style={styles.netLabel}>NET SALARY</Text>
                  <Text style={styles.netNum}>{f(activeSlip.netSalary)}</Text>
                </View>
                <View style={styles.paidBadge}>
                  <Text style={styles.paidText}>PAID</Text>
                </View>
              </View>

              <View style={styles.breakdownGrid}>
                {/* Gross / Basic */}
                <View style={styles.breakdownCol}>
                  <Text style={styles.breakdownLabel}>Gross</Text>
                  <Text style={styles.breakdownVal}>
                    {f(Number(activeSlip.basicSalary) + Number(activeSlip.hra) + Number(activeSlip.allowances))}
                  </Text>
                </View>
                <View style={styles.breakdownCol}>
                  <Text style={styles.breakdownLabel}>Basic</Text>
                  <Text style={styles.breakdownVal}>{f(activeSlip.basicSalary)}</Text>
                </View>

                {/* HRA / Allowances */}
                <View style={styles.breakdownCol}>
                  <Text style={styles.breakdownLabel}>HRA</Text>
                  <Text style={styles.breakdownVal}>{f(activeSlip.hra)}</Text>
                </View>
                <View style={styles.breakdownCol}>
                  <Text style={styles.breakdownLabel}>Allowances</Text>
                  <Text style={styles.breakdownVal}>{f(activeSlip.allowances)}</Text>
                </View>

                {/* PF / TDS */}
                <View style={styles.breakdownCol}>
                  <Text style={styles.breakdownLabel}>PF Deduction</Text>
                  <Text style={[styles.breakdownVal, { color: '#ef4444' }]}>
                    -{f(activeSlip.pfDeduction)}
                  </Text>
                </View>
                <View style={styles.breakdownCol}>
                  <Text style={styles.breakdownLabel}>TDS</Text>
                  <Text style={[styles.breakdownVal, { color: '#ef4444' }]}>
                    -{f(activeSlip.tds)}
                  </Text>
                </View>
              </View>

              <View style={styles.divider} />

              <TouchableOpacity
                style={[styles.downloadBtn, downloading && { opacity: 0.8 }]}
                onPress={handleDownload}
                disabled={downloading}
                activeOpacity={0.8}
              >
                {downloading ? (
                  <ActivityIndicator color="#2563eb" />
                ) : (
                  <>
                    <Ionicons name="download-outline" size={16} color="#2563eb" style={{ marginRight: 6 }} />
                    <Text style={styles.downloadBtnText}>Download PDF</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>

            {/* ALL PAYSLIPS */}
            <Text style={styles.sectionTitle}>ALL PAYSLIPS</Text>
            <View style={styles.listCard}>
              {payslips.map((ps, idx) => (
                <View key={ps.id}>
                  {idx > 0 && <View style={styles.divider} />}
                  <TouchableOpacity
                    style={[styles.listRow, selectedIdx === idx && styles.rowSelected]}
                    onPress={() => setSelectedIdx(idx)}
                    activeOpacity={0.7}
                  >
                    <View style={[styles.iconBox, { backgroundColor: '#fff7ed' }]}>
                      <Ionicons name="document-text-outline" size={20} color="#ea580c" />
                    </View>
                    <View style={styles.rowInfo}>
                      <Text style={styles.rowTitle}>{getMonthName(ps.month, ps.year)}</Text>
                      <Text style={styles.rowSub}>
                        Gross {f(Number(ps.basicSalary) + Number(ps.hra) + Number(ps.allowances))} • Net {f(ps.netSalary)}
                      </Text>
                    </View>
                    <Ionicons name="download-outline" size={18} color="#94a3b8" />
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          </>
        ) : (
          <Text style={styles.emptyText}>No payslips found for your account.</Text>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 40,
  },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 18,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0f172a',
    letterSpacing: -0.5,
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#64748b',
    fontWeight: '500',
    marginTop: 2,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: '#94a3b8',
    marginTop: 20,
    marginBottom: 10,
    letterSpacing: 0.8,
  },
  detailsCard: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#f1f5f9',
    borderRadius: 20,
    padding: 20,
  },
  netRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  netLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#94a3b8',
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  netNum: {
    fontSize: 26,
    fontWeight: '900',
    color: '#0f172a',
  },
  paidBadge: {
    backgroundColor: '#f0fdf4',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  paidText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#15803d',
  },
  breakdownGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    rowGap: 14,
    columnGap: 0,
    marginBottom: 20,
  },
  breakdownCol: {
    width: '50%',
  },
  breakdownLabel: {
    fontSize: 11,
    color: '#94a3b8',
    fontWeight: '500',
    marginBottom: 2,
  },
  breakdownVal: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0f172a',
  },
  downloadBtn: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#2563eb',
    borderRadius: 12,
    height: 48,
    marginTop: 18,
  },
  downloadBtnText: {
    color: '#2563eb',
    fontSize: 13,
    fontWeight: '700',
  },
  listCard: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#f1f5f9',
    borderRadius: 20,
    paddingHorizontal: 20,
  },
  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
  },
  rowSelected: {
    backgroundColor: '#f8fafc',
    marginHorizontal: -20,
    paddingHorizontal: 20,
  },
  iconBox: {
    width: 38,
    height: 38,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  rowInfo: {
    flex: 1,
  },
  rowTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 2,
  },
  rowSub: {
    fontSize: 11,
    color: '#64748b',
    fontWeight: '500',
  },
  divider: {
    height: 1,
    backgroundColor: '#f1f5f9',
  },
  emptyText: {
    fontSize: 13,
    color: '#94a3b8',
    fontWeight: '500',
    textAlign: 'center',
    paddingVertical: 32,
  },
});
