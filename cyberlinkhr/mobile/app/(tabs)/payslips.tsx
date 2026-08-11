import { useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  ActivityIndicator, Modal, RefreshControl, Alert,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Ionicons } from '@expo/vector-icons';
import api from '@/lib/api';

function fmt(n: number | string | null | undefined) {
  if (n == null) return '—';
  return '₹' + Number(n).toLocaleString('en-IN', { maximumFractionDigits: 0 });
}

function Row({ label, value, bold, color }: { label: string; value: string; bold?: boolean; color?: string }) {
  return (
    <View style={styles.row}>
      <Text style={[styles.rowLabel, bold && { fontWeight: '700', color: '#0f172a' }]}>{label}</Text>
      <Text style={[styles.rowValue, bold && { fontWeight: '800' }, color && { color }]}>{value}</Text>
    </View>
  );
}

function buildPayslipHtml(ps: any): string {
  const fmt = (n: any) => n != null ? '₹' + Number(n).toLocaleString('en-IN', { maximumFractionDigits: 0 }) : '—';
  const monthLabel = new Date(ps.year, ps.month - 1).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
  const name = ps.firstName ? `${ps.firstName} ${ps.lastName || ''}`.trim() : '';
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
    body{font-family:Arial,sans-serif;padding:24px;color:#0f172a;font-size:13px}
    h1{color:#2563EB;margin:0 0 4px}h2{font-size:13px;color:#64748b;margin:0 0 24px;font-weight:normal}
    table{width:100%;border-collapse:collapse;margin-bottom:20px}
    th{background:#f8fafc;padding:8px 12px;text-align:left;font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:.05em}
    td{padding:8px 12px;border-bottom:1px solid #e2e8f0}
    .right{text-align:right}.bold{font-weight:700}.net{background:#2563EB;color:#fff;padding:12px 20px;border-radius:8px;display:flex;justify-content:space-between}
  </style></head><body>
    <h1>CyberlinkHR — Payslip</h1>
    <h2>${monthLabel}${name ? ' · ' + name : ''}</h2>
    <table><tr><th>Earnings</th><th class="right">Amount</th><th>Deductions</th><th class="right">Amount</th></tr>
    <tr><td>Basic</td><td class="right">${fmt(ps.basic)}</td><td>PF (Emp 12%)</td><td class="right">${fmt(ps.pfEmployee)}</td></tr>
    <tr><td>HRA</td><td class="right">${fmt(ps.hra)}</td><td>ESIC (Emp 0.75%)</td><td class="right">${fmt(ps.esicEmployee)}</td></tr>
    <tr><td>Special Allowance</td><td class="right">${fmt(ps.specialAllowance)}</td><td>Professional Tax</td><td class="right">${fmt(ps.professionalTax)}</td></tr>
    <tr><td>LOP Deduction</td><td class="right">-${fmt(ps.lopAmount)}</td><td>TDS</td><td class="right">${fmt(ps.tds)}</td></tr>
    <tr><td class="bold">Gross Salary</td><td class="right bold">${fmt(ps.grossSalary)}</td><td class="bold">Total Deductions</td><td class="right bold">${fmt(ps.totalDeductions)}</td></tr>
    </table>
    <div class="net"><span>NET TAKE-HOME</span><span class="bold">${fmt(ps.netSalary)}</span></div>
  </body></html>`;
}

async function downloadPayslipPdf(ps: any) {
  try {
    const { uri } = await Print.printToFileAsync({ html: buildPayslipHtml(ps), base64: false });
    const monthLabel = new Date(ps.year, ps.month - 1).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' }).replace(' ', '-');
    const canShare = await Sharing.isAvailableAsync();
    if (canShare) {
      await Sharing.shareAsync(uri, {
        mimeType: 'application/pdf',
        dialogTitle: `Payslip ${monthLabel}`,
        UTI: 'com.adobe.pdf',
      });
    } else {
      Alert.alert('Sharing not available on this device');
    }
  } catch (e: any) {
    Alert.alert('Error', e.message || 'Failed to generate PDF');
  }
}

export default function PayslipsScreen() {
  const [selected, setSelected] = useState<any>(null);

  const { data: payslips, isLoading, isRefetching, refetch } = useQuery<any[]>({
    queryKey: ['my-payslips'],
    queryFn: () => api.get('/api/payroll/my-payslips').then(r => r.data.data),
  });

  const { data: payslipDetail, isLoading: detailLoading } = useQuery<any>({
    queryKey: ['payslip-detail', selected?.id],
    queryFn: () => api.get(`/api/payroll/my-payslips/${selected.id}`).then(r => r.data.data),
    enabled: !!selected?.id,
  });

  return (
    <View style={{ flex: 1 }}>
      <ScrollView
        style={styles.container}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor="#2563EB" />}
      >
        <View style={styles.header}>
          <Text style={styles.headerTitle}>My Payslips</Text>
        </View>

        <View style={styles.section}>
          {isLoading ? (
            <ActivityIndicator color="#2563EB" />
          ) : (payslips || []).length === 0 ? (
            <Text style={{ color: '#94a3b8', textAlign: 'center', padding: 40 }}>No payslips yet.</Text>
          ) : (payslips || []).map((ps: any) => (
            <TouchableOpacity key={ps.id} style={styles.psCard} onPress={() => setSelected(ps)}>
              <View style={{ flex: 1 }}>
                <Text style={styles.psMonth}>
                  {new Date(ps.year, ps.month - 1).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}
                </Text>
                <Text style={styles.psMeta}>
                  {ps.workingDays ?? '—'} working days · {ps.lopDays ?? 0} LOP
                </Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={styles.psNetPay}>{fmt(ps.netSalary)}</Text>
                <Text style={styles.psLabel}>Net Pay</Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>

        <View style={{ height: 24 }} />
      </ScrollView>

      {/* Payslip detail modal */}
      <Modal visible={!!selected} animationType="slide" presentationStyle="pageSheet">
        <View style={{ flex: 1, backgroundColor: '#fff' }}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>
              {selected && new Date(selected.year, selected.month - 1).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}
            </Text>
            <TouchableOpacity onPress={() => setSelected(null)}>
              <Text style={{ fontSize: 22, color: '#94a3b8' }}>×</Text>
            </TouchableOpacity>
          </View>

          {detailLoading ? (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
              <ActivityIndicator color="#2563EB" size="large" />
            </View>
          ) : payslipDetail && (
            <ScrollView style={{ padding: 20 }}>
              {/* Employee info */}
              <View style={styles.empBox}>
                <View style={styles.empAvatar}>
                  <Text style={{ color: '#2563EB', fontWeight: '800', fontSize: 18 }}>
                    {payslipDetail.firstName?.[0] || '?'}
                  </Text>
                </View>
                <View>
                  <Text style={{ fontSize: 16, fontWeight: '700', color: '#0f172a' }}>{payslipDetail.firstName} {payslipDetail.lastName}</Text>
                  <Text style={{ fontSize: 13, color: '#64748b' }}>{payslipDetail.departmentName || 'Employee'}</Text>
                </View>
              </View>

              {/* Earnings */}
              <Text style={styles.subTitle}>Earnings</Text>
              <View style={styles.section2}>
                <Row label="Basic" value={fmt(payslipDetail.basic)} />
                <Row label="HRA" value={fmt(payslipDetail.hra)} />
                <Row label="Special Allowance" value={fmt(payslipDetail.specialAllowance)} />
                {payslipDetail.otherEarnings > 0 && <Row label="Other Allowances" value={fmt(payslipDetail.otherEarnings)} />}
                <View style={styles.divider} />
                <Row label="Gross Salary" value={fmt(payslipDetail.grossSalary)} bold />
              </View>

              {/* Deductions */}
              <Text style={styles.subTitle}>Deductions</Text>
              <View style={styles.section2}>
                <Row label="PF (Employee 12%)" value={fmt(payslipDetail.pfEmployee)} />
                {payslipDetail.esicEmployee > 0 && <Row label="ESIC (Employee 0.75%)" value={fmt(payslipDetail.esicEmployee)} />}
                {payslipDetail.professionalTax > 0 && <Row label="Professional Tax" value={fmt(payslipDetail.professionalTax)} />}
                {payslipDetail.tds > 0 && <Row label="TDS" value={fmt(payslipDetail.tds)} />}
                {payslipDetail.lopAmount > 0 && <Row label={`LOP (${payslipDetail.lopDays}d)`} value={fmt(payslipDetail.lopAmount)} />}
                <View style={styles.divider} />
                <Row label="Total Deductions" value={fmt(payslipDetail.totalDeductions)} bold color="#ef4444" />
              </View>

              {/* Net */}
              <View style={styles.netBox}>
                <Text style={styles.netLabel}>Net Take-Home Pay</Text>
                <Text style={styles.netValue}>{fmt(payslipDetail.netSalary)}</Text>
              </View>

              {/* Share PDF */}
              <TouchableOpacity
                style={{ backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 12, padding: 14, alignItems: 'center', marginBottom: 16, flexDirection: 'row', justifyContent: 'center', gap: 8 }}
                onPress={() => downloadPayslipPdf(payslipDetail)}
              >
                <Ionicons name="document-text-outline" size={18} color="#2563EB" />
                <Text style={{ fontSize: 14, fontWeight: '700', color: '#2563EB' }}>Download / Share PDF</Text>
              </TouchableOpacity>

              {/* Employer contributions */}
              <Text style={styles.subTitle}>Employer Contributions (not deducted)</Text>
              <View style={styles.section2}>
                <Row label="PF (Employer 12%)" value={fmt(payslipDetail.pfEmployer)} />
                {payslipDetail.esicEmployer > 0 && <Row label="ESIC (Employer 3.25%)" value={fmt(payslipDetail.esicEmployer)} />}
                <View style={styles.divider} />
                <Row label="Gross CTC" value={fmt(
                  (Number(payslipDetail.grossSalary) || 0) +
                  (Number(payslipDetail.pfEmployer) || 0) +
                  (Number(payslipDetail.esicEmployer) || 0)
                )} bold />
              </View>

              <View style={{ height: 48 }} />
            </ScrollView>
          )}
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  header: { backgroundColor: '#2563EB', padding: 20, paddingTop: 56 },
  headerTitle: { color: '#fff', fontSize: 24, fontWeight: '800' },
  section: { marginHorizontal: 16, marginTop: 20 },
  psCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 16,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  psMonth: { fontSize: 16, fontWeight: '700', color: '#0f172a' },
  psMeta: { fontSize: 12, color: '#64748b', marginTop: 3 },
  psNetPay: { fontSize: 20, fontWeight: '800', color: '#22c55e' },
  psLabel: { fontSize: 11, color: '#94a3b8', marginTop: 2 },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    paddingTop: 24,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  modalTitle: { fontSize: 18, fontWeight: '800', color: '#0f172a' },
  empBox: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 20, padding: 16, backgroundColor: '#eff6ff', borderRadius: 14 },
  empAvatar: { width: 50, height: 50, borderRadius: 25, backgroundColor: '#dbeafe', alignItems: 'center', justifyContent: 'center' },
  subTitle: { fontSize: 13, fontWeight: '700', color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8, marginTop: 4 },
  section2: { backgroundColor: '#f8fafc', borderRadius: 12, padding: 14, marginBottom: 16 },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 },
  rowLabel: { fontSize: 14, color: '#64748b' },
  rowValue: { fontSize: 14, color: '#0f172a', fontWeight: '500' },
  divider: { height: 1, backgroundColor: '#e2e8f0', marginVertical: 6 },
  netBox: { backgroundColor: '#2563EB', borderRadius: 14, padding: 20, alignItems: 'center', marginBottom: 20 },
  netLabel: { color: 'rgba(255,255,255,0.8)', fontSize: 13, marginBottom: 4 },
  netValue: { color: '#fff', fontSize: 32, fontWeight: '800' },
});
