import { useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  ActivityIndicator, Modal, RefreshControl, Alert,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Ionicons } from '@expo/vector-icons';
import api from '@/src/lib/api';

function fmt(n: number | string | null | undefined) {
  if (n == null || n === '') return '—';
  return '₹' + Number(n).toLocaleString('en-IN', { maximumFractionDigits: 0 });
}

function buildPayslipHtml(ps: any): string {
  const f = (n: any) => n != null && n !== '' ? '₹' + Number(n).toLocaleString('en-IN', { maximumFractionDigits: 0 }) : '—';
  const monthLabel = new Date(ps.year, ps.month - 1).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
  const name = [ps.firstName, ps.lastName].filter(Boolean).join(' ');
  return `<!DOCTYPE html><html><head><meta charset="utf-8">
  <style>body{font-family:Arial,sans-serif;padding:32px;color:#0f172a;font-size:13px;max-width:600px;margin:0 auto}
  h1{color:#2563EB;margin:0 0 4px;font-size:20px}h2{font-size:12px;color:#64748b;margin:0 0 28px;font-weight:400}
  table{width:100%;border-collapse:collapse;margin-bottom:20px}
  th{background:#f8fafc;padding:8px 14px;text-align:left;font-size:10px;color:#94a3b8;text-transform:uppercase;border-bottom:2px solid #e2e8f0}
  td{padding:10px 14px;border-bottom:1px solid #f1f5f9;font-size:13px}
  .right{text-align:right}.bold{font-weight:700;color:#0f172a}
  .net{background:#2563EB;color:#fff;padding:16px 20px;border-radius:12px;display:flex;justify-content:space-between;font-size:15px}
  </style></head><body>
  <h1>CyberlinkHR — Payslip</h1>
  <h2>${monthLabel}${name ? ' · ' + name : ''}${ps.departmentName ? ' · ' + ps.departmentName : ''}</h2>
  <table><tr><th>Earnings</th><th class="right">Amount</th><th>Deductions</th><th class="right">Amount</th></tr>
  <tr><td>Basic</td><td class="right">${f(ps.basic)}</td><td>PF (Emp 12%)</td><td class="right">${f(ps.pfEmployee)}</td></tr>
  <tr><td>HRA</td><td class="right">${f(ps.hra)}</td><td>ESIC</td><td class="right">${f(ps.esicEmployee)}</td></tr>
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

  const { data: me } = useQuery<any>({
    queryKey: ['me'],
    queryFn: () => api.get('/api/employees/me').then(r => r.data.data),
  });

  const { data: payslips, isLoading, isRefetching, refetch } = useQuery<any[]>({
    queryKey: ['my-payslips'],
    queryFn: () => api.get('/api/payroll/my-payslips').then(r => r.data.data),
  });

  // Auto-select latest payslip when the list loads
  const currentSelected = selected || payslips?.[0];

  const { data: payslipDetail, isLoading: detailLoading } = useQuery<any>({
    queryKey: ['payslip-detail', currentSelected?.id],
    queryFn: () => api.get(`/api/payroll/my-payslips/${currentSelected.id}`).then(r => r.data.data),
    enabled: !!currentSelected?.id,
  });

  const empCode = me?.employeeCode || me?.code || 'EMP-001';
  const fullName = me ? `${me.firstName} ${me.lastName || ''}`.trim() : 'Abbas Ali';
  const deptName = me?.departmentName || me?.department?.name || 'Engineer Team';
  const headerSubtitle = `${empCode} • ${fullName} • ${deptName}`;

  const selectedMonthLabel = currentSelected
    ? new Date(currentSelected.year, currentSelected.month - 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    : '';

  return (
    <View style={{ flex: 1 }}>
      <ScrollView
        style={styles.container}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor="#2563EB" />}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Payslips</Text>
          <Text style={styles.headerSub}>{headerSubtitle}</Text>
        </View>

        <View style={{ height: 12 }} />

        {isLoading ? (
          <ActivityIndicator color="#2563EB" style={{ marginTop: 40 }} />
        ) : payslips && payslips.length > 0 ? (
          <View style={{ gap: 14 }}>
            {/* LATEST Detail Card */}
            <Text style={styles.sectionLabel}>LATEST — {selectedMonthLabel.toUpperCase()}</Text>
            <View style={styles.detailCard}>
              {detailLoading || !payslipDetail ? (
                <ActivityIndicator color="#2563EB" style={{ padding: 40 }} />
              ) : (
                <View>
                  {/* Net take-home summary */}
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                    <View>
                      <Text style={styles.netLabel}>NET SALARY</Text>
                      <Text style={styles.netValue}>{fmt(payslipDetail.netSalary)}</Text>
                    </View>
                    <View style={styles.paidBadge}>
                      <Text style={styles.paidBadgeText}>PAID</Text>
                    </View>
                  </View>

                  <View style={styles.divider} />

                  {/* Grid Breakdown */}
                  <View style={styles.grid}>
                    <View style={styles.gridRow}>
                      <View style={styles.gridCol}>
                        <Text style={styles.gridLabel}>Gross</Text>
                        <Text style={styles.gridValue}>{fmt(payslipDetail.grossSalary)}</Text>
                      </View>
                      <View style={[styles.gridCol, { paddingLeft: 16 }]}>
                        <Text style={styles.gridLabel}>Basic</Text>
                        <Text style={styles.gridValue}>{fmt(payslipDetail.basic)}</Text>
                      </View>
                    </View>

                    <View style={styles.gridRow}>
                      <View style={styles.gridCol}>
                        <Text style={styles.gridLabel}>HRA</Text>
                        <Text style={styles.gridValue}>{fmt(payslipDetail.hra)}</Text>
                      </View>
                      <View style={[styles.gridCol, { paddingLeft: 16 }]}>
                        <Text style={styles.gridLabel}>Allowances</Text>
                        <Text style={styles.gridValue}>{fmt(payslipDetail.specialAllowance)}</Text>
                      </View>
                    </View>

                    <View style={[styles.gridRow, { borderBottomWidth: 0 }]}>
                      <View style={styles.gridCol}>
                        <Text style={styles.gridLabel}>PF Deduction</Text>
                        <Text style={[styles.gridValue, { color: '#ef4444' }]}>-{fmt(payslipDetail.pfEmployee)}</Text>
                      </View>
                      <View style={[styles.gridCol, { paddingLeft: 16 }]}>
                        <Text style={styles.gridLabel}>TDS</Text>
                        <Text style={[styles.gridValue, { color: '#ef4444' }]}>-{fmt(payslipDetail.tds || 0)}</Text>
                      </View>
                    </View>
                  </View>

                  {/* Download PDF button */}
                  <TouchableOpacity style={styles.downloadBtn} onPress={() => downloadPdf(payslipDetail)}>
                    <Ionicons name="download-outline" size={16} color="#2563eb" />
                    <Text style={styles.downloadBtnText}>Download PDF</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>

            {/* All Payslips Section */}
            <Text style={styles.sectionLabel}>ALL PAYSLIPS</Text>
            <View style={[styles.card, { marginBottom: 24 }]}>
              {payslips.map((ps: any, i: number, arr: any[]) => {
                const monthName = new Date(ps.year, ps.month - 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
                const isCurrent = currentSelected?.id === ps.id;
                return (
                  <TouchableOpacity
                    key={ps.id}
                    style={[styles.psItem, i === arr.length - 1 && { borderBottomWidth: 0 }, isCurrent && { backgroundColor: '#f8fafc' }]}
                    onPress={() => setSelected(ps)}
                    activeOpacity={0.7}
                  >
                    <View style={[styles.iconBox, { backgroundColor: '#fff7ed' }]}>
                      <Ionicons name="document-text-outline" size={18} color="#ea580c" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.psMonth}>{monthName}</Text>
                      <Text style={styles.psMeta}>
                        Gross {fmt(ps.grossSalary)} • Net {fmt(ps.netSalary)}
                      </Text>
                    </View>
                    <TouchableOpacity onPress={() => downloadPdf(ps)} style={{ padding: 8 }}>
                      <Ionicons name="download-outline" size={18} color="#cbd5e1" />
                    </TouchableOpacity>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        ) : (
          <View style={styles.emptyState}>
            <Ionicons name="document-text-outline" size={40} color="#cbd5e1" />
            <Text style={styles.emptyText}>No payslips yet.</Text>
            <Text style={styles.emptySub}>Disbursed payslips will appear here.</Text>
          </View>
        )}

        <View style={{ height: 24 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  header: { backgroundColor: '#ffffff', paddingTop: 52, paddingBottom: 14, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  headerTitle: { fontSize: 18, fontWeight: '800', color: '#0f172a', letterSpacing: -0.3 },
  headerSub: { fontSize: 11, color: '#64748b', marginTop: 3 },
  sectionLabel: {
    fontSize: 10, fontWeight: '700', color: '#94a3b8', letterSpacing: 0.6,
    textTransform: 'uppercase', paddingHorizontal: 16, paddingTop: 14, paddingBottom: 6,
  },
  detailCard: {
    backgroundColor: '#ffffff', borderRadius: 12, marginHorizontal: 12,
    borderWidth: 1, borderColor: '#f1f5f9', padding: 16,
    shadowColor: '#0f172a', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 3,
    elevation: 1,
  },
  card: { backgroundColor: '#ffffff', borderRadius: 12, marginHorizontal: 12, borderWidth: 1, borderColor: '#f1f5f9', elevation: 1, overflow: 'hidden' },
  psItem: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 13, borderBottomWidth: 1, borderBottomColor: '#f8fafc' },
  iconBox: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  psMonth: { fontSize: 13, fontWeight: '600', color: '#0f172a' },
  psMeta: { fontSize: 10, color: '#94a3b8', marginTop: 1 },
  emptyState: { alignItems: 'center', paddingVertical: 48, gap: 8 },
  emptyText: { fontSize: 14, fontWeight: '700', color: '#94a3b8' },
  emptySub: { fontSize: 12, color: '#cbd5e1' },
  divider: { height: 1, backgroundColor: '#f1f5f9', marginVertical: 12 },
  netLabel: { fontSize: 9, fontWeight: '700', color: '#94a3b8', letterSpacing: 0.5, marginBottom: 4 },
  netValue: { fontSize: 24, fontWeight: '800', color: '#0f172a', letterSpacing: -0.5 },
  paidBadge: { backgroundColor: '#f0fdf4', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  paidBadgeText: { color: '#16a34a', fontSize: 10, fontWeight: '800' },
  grid: { gap: 10 },
  gridRow: { flexDirection: 'row', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: '#f8fafc', paddingBottom: 10 },
  gridCol: { flex: 1 },
  gridLabel: { fontSize: 9, fontWeight: '700', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 },
  gridValue: { fontSize: 14, fontWeight: '700', color: '#0f172a' },
  downloadBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    borderWidth: 1.5, borderColor: '#2563eb', borderRadius: 12, padding: 12, marginTop: 16,
  },
  downloadBtnText: { fontSize: 13, fontWeight: '700', color: '#2563eb' },
});
