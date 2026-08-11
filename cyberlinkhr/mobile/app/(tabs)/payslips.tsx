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
  if (n == null || n === '') return '—';
  return '₹' + Number(n).toLocaleString('en-IN', { maximumFractionDigits: 0 });
}

function Row({ label, value, bold, color }: { label: string; value: string; bold?: boolean; color?: string }) {
  return (
    <View style={styles.row}>
      <Text style={[styles.rowLabel, bold && { fontWeight: '700', color: '#0f172a' }]}>{label}</Text>
      <Text style={[styles.rowValue, bold && { fontWeight: '800', color: '#0f172a' }, color ? { color } : {}]}>{value}</Text>
    </View>
  );
}

function buildPayslipHtml(ps: any): string {
  const f = (n: any) => n != null && n !== '' ? '₹' + Number(n).toLocaleString('en-IN', { maximumFractionDigits: 0 }) : '—';
  const monthLabel = new Date(ps.year, ps.month - 1).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
  const name = [ps.firstName, ps.lastName].filter(Boolean).join(' ');
  return `<!DOCTYPE html><html><head><meta charset="utf-8">
  <style>body{font-family:Inter,Arial,sans-serif;padding:32px;color:#0f172a;font-size:13px;max-width:600px;margin:0 auto}
  h1{color:#2563EB;margin:0 0 4px;font-size:20px}h2{font-size:12px;color:#64748b;margin:0 0 28px;font-weight:400}
  table{width:100%;border-collapse:collapse;margin-bottom:20px}
  th{background:#f8fafc;padding:8px 14px;text-align:left;font-size:10px;color:#94a3b8;text-transform:uppercase;letter-spacing:.06em;border-bottom:2px solid #e2e8f0}
  td{padding:10px 14px;border-bottom:1px solid #f1f5f9;font-size:13px}
  .right{text-align:right}.bold{font-weight:700;color:#0f172a}
  .net{background:#2563EB;color:#fff;padding:16px 20px;border-radius:12px;display:flex;justify-content:space-between;font-size:15px;margin-top:8px}
  </style></head><body>
  <h1>CyberlinkHR — Payslip</h1>
  <h2>${monthLabel}${name ? ' · ' + name : ''}${ps.departmentName ? ' · ' + ps.departmentName : ''}</h2>
  <table><tr><th>Earnings</th><th class="right">Amount</th><th>Deductions</th><th class="right">Amount</th></tr>
  <tr><td>Basic</td><td class="right">${f(ps.basic)}</td><td>PF (Emp 12%)</td><td class="right">${f(ps.pfEmployee)}</td></tr>
  <tr><td>HRA</td><td class="right">${f(ps.hra)}</td><td>ESIC (Emp 0.75%)</td><td class="right">${f(ps.esicEmployee)}</td></tr>
  <tr><td>Special Allowance</td><td class="right">${f(ps.specialAllowance)}</td><td>Professional Tax</td><td class="right">${f(ps.professionalTax)}</td></tr>
  <tr><td>LOP Deduction</td><td class="right">-${f(ps.lopAmount)}</td><td>TDS</td><td class="right">${f(ps.tds)}</td></tr>
  <tr><td class="bold">Gross Salary</td><td class="right bold">${f(ps.grossSalary)}</td><td class="bold">Total Deductions</td><td class="right bold">${f(ps.totalDeductions)}</td></tr>
  </table>
  <div class="net"><span>NET TAKE-HOME</span><span class="bold">${f(ps.netSalary)}</span></div>
  </body></html>`;
}

async function downloadPdf(ps: any) {
  try {
    const { uri } = await Print.printToFileAsync({ html: buildPayslipHtml(ps), base64: false });
    const canShare = await Sharing.isAvailableAsync();
    if (canShare) {
      const monthLabel = new Date(ps.year, ps.month - 1).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' }).replace(' ', '-');
      await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: `Payslip ${monthLabel}`, UTI: 'com.adobe.pdf' });
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
          <Text style={styles.headerSub}>Download & share as PDF</Text>
        </View>

        <View style={{ height: 12 }} />

        {isLoading ? (
          <ActivityIndicator color="#2563EB" style={{ marginTop: 40 }} />
        ) : (payslips || []).length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="document-text-outline" size={40} color="#cbd5e1" />
            <Text style={styles.emptyText}>No payslips yet.</Text>
            <Text style={styles.emptySub}>Disbursed payslips will appear here.</Text>
          </View>
        ) : (
          <View style={styles.card}>
            {(payslips || []).map((ps: any, i: number, arr: any[]) => (
              <TouchableOpacity
                key={ps.id}
                style={[styles.psItem, i === arr.length - 1 && { borderBottomWidth: 0 }]}
                onPress={() => setSelected(ps)}
                activeOpacity={0.7}
              >
                <View style={[styles.iconBox, { backgroundColor: '#fff7ed' }]}>
                  <Ionicons name="document-text-outline" size={18} color="#ea580c" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.psMonth}>
                    {new Date(ps.year, ps.month - 1).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}
                  </Text>
                  <Text style={styles.psMeta}>
                    {ps.workingDays ?? '—'} working days · {ps.lopDays ?? 0} LOP
                  </Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={styles.psNet}>{fmt(ps.netSalary)}</Text>
                  <Text style={styles.psNetLabel}>Net Pay</Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}

        <View style={{ height: 24 }} />
      </ScrollView>

      {/* Detail modal */}
      <Modal visible={!!selected} animationType="slide" presentationStyle="pageSheet">
        <View style={{ flex: 1, backgroundColor: '#fff' }}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>
              {selected && new Date(selected.year, selected.month - 1).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}
            </Text>
            <TouchableOpacity onPress={() => setSelected(null)} style={styles.closeBtn}>
              <Ionicons name="close" size={18} color="#64748b" />
            </TouchableOpacity>
          </View>

          {detailLoading ? (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
              <ActivityIndicator color="#2563EB" size="large" />
            </View>
          ) : payslipDetail ? (
            <ScrollView style={{ padding: 16 }}>
              {/* Employee info */}
              <View style={styles.empBox}>
                <View style={styles.empAvatar}>
                  <Text style={{ color: '#2563eb', fontWeight: '800', fontSize: 18 }}>
                    {payslipDetail.firstName?.[0] || '?'}
                  </Text>
                </View>
                <View>
                  <Text style={{ fontSize: 15, fontWeight: '800', color: '#0f172a', letterSpacing: -0.3 }}>
                    {[payslipDetail.firstName, payslipDetail.lastName].filter(Boolean).join(' ')}
                  </Text>
                  <Text style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>{payslipDetail.departmentName || 'Employee'}</Text>
                </View>
              </View>

              {/* Earnings */}
              <Text style={styles.subTitle}>Earnings</Text>
              <View style={styles.section}>
                <Row label="Basic" value={fmt(payslipDetail.basic)} />
                <Row label="HRA" value={fmt(payslipDetail.hra)} />
                <Row label="Special Allowance" value={fmt(payslipDetail.specialAllowance)} />
                {Number(payslipDetail.otherEarnings) > 0 && <Row label="Other Allowances" value={fmt(payslipDetail.otherEarnings)} />}
                <View style={styles.divider} />
                <Row label="Gross Salary" value={fmt(payslipDetail.grossSalary)} bold />
              </View>

              {/* Deductions */}
              <Text style={styles.subTitle}>Deductions</Text>
              <View style={styles.section}>
                <Row label="PF (Employee 12%)" value={fmt(payslipDetail.pfEmployee)} />
                {Number(payslipDetail.esicEmployee) > 0 && <Row label="ESIC (Employee 0.75%)" value={fmt(payslipDetail.esicEmployee)} />}
                {Number(payslipDetail.professionalTax) > 0 && <Row label="Professional Tax" value={fmt(payslipDetail.professionalTax)} />}
                {Number(payslipDetail.tds) > 0 && <Row label="TDS" value={fmt(payslipDetail.tds)} />}
                {Number(payslipDetail.lopAmount) > 0 && <Row label={`LOP (${payslipDetail.lopDays}d)`} value={fmt(payslipDetail.lopAmount)} />}
                <View style={styles.divider} />
                <Row label="Total Deductions" value={fmt(payslipDetail.totalDeductions)} bold color="#ef4444" />
              </View>

              {/* Net Pay */}
              <View style={styles.netBox}>
                <Text style={styles.netLabel}>Net Take-Home Pay</Text>
                <Text style={styles.netValue}>{fmt(payslipDetail.netSalary)}</Text>
              </View>

              {/* Download */}
              <TouchableOpacity style={styles.downloadBtn} onPress={() => downloadPdf(payslipDetail)}>
                <Ionicons name="download-outline" size={18} color="#2563eb" />
                <Text style={{ fontSize: 14, fontWeight: '700', color: '#2563eb' }}>Download / Share PDF</Text>
              </TouchableOpacity>

              {/* Employer contributions */}
              <Text style={styles.subTitle}>Employer Contributions</Text>
              <View style={styles.section}>
                <Row label="PF (Employer 12%)" value={fmt(payslipDetail.pfEmployer)} />
                {Number(payslipDetail.esicEmployer) > 0 && <Row label="ESIC (Employer 3.25%)" value={fmt(payslipDetail.esicEmployer)} />}
                <View style={styles.divider} />
                <Row label="Gross CTC" value={fmt(
                  (Number(payslipDetail.grossSalary) || 0) +
                  (Number(payslipDetail.pfEmployer) || 0) +
                  (Number(payslipDetail.esicEmployer) || 0)
                )} bold />
              </View>

              <View style={{ height: 48 }} />
            </ScrollView>
          ) : null}
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  header: {
    backgroundColor: '#fff',
    paddingTop: 52,
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  headerTitle: { fontSize: 20, fontWeight: '800', color: '#0f172a', letterSpacing: -0.4 },
  headerSub: { fontSize: 11, color: '#94a3b8', marginTop: 2 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    marginHorizontal: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#f1f5f9',
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  iconBox: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  psItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 13,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f8fafc',
  },
  psMonth: { fontSize: 13, fontWeight: '700', color: '#0f172a' },
  psMeta: { fontSize: 10, color: '#94a3b8', marginTop: 1 },
  psNet: { fontSize: 15, fontWeight: '800', color: '#22c55e' },
  psNetLabel: { fontSize: 9, color: '#94a3b8', marginTop: 1 },
  emptyState: { alignItems: 'center', padding: 48, gap: 10 },
  emptyText: { fontSize: 14, fontWeight: '600', color: '#64748b' },
  emptySub: { fontSize: 12, color: '#94a3b8' },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    paddingTop: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  modalTitle: { fontSize: 17, fontWeight: '800', color: '#0f172a', letterSpacing: -0.3 },
  closeBtn: { padding: 6, backgroundColor: '#f1f5f9', borderRadius: 8 },
  empBox: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 18, padding: 14, backgroundColor: '#eff6ff', borderRadius: 12 },
  empAvatar: { width: 44, height: 44, borderRadius: 11, backgroundColor: '#dbeafe', alignItems: 'center', justifyContent: 'center' },
  subTitle: { fontSize: 10, fontWeight: '700', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 6, marginTop: 4 },
  section: { backgroundColor: '#f8fafc', borderRadius: 10, padding: 12, marginBottom: 14, borderWidth: 1, borderColor: '#f1f5f9' },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 5 },
  rowLabel: { fontSize: 13, color: '#64748b' },
  rowValue: { fontSize: 13, color: '#0f172a', fontWeight: '500' },
  divider: { height: 1, backgroundColor: '#e2e8f0', marginVertical: 5 },
  netBox: { backgroundColor: '#2563EB', borderRadius: 12, padding: 18, alignItems: 'center', marginBottom: 16 },
  netLabel: { color: 'rgba(255,255,255,0.8)', fontSize: 12, marginBottom: 4 },
  netValue: { color: '#fff', fontSize: 28, fontWeight: '800', letterSpacing: -0.5 },
  downloadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#eff6ff',
    borderRadius: 10,
    padding: 13,
    marginBottom: 18,
    borderWidth: 1,
    borderColor: '#dbeafe',
  },
});
