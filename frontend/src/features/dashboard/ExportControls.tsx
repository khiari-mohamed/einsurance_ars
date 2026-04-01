import { useState } from 'react';

interface ExportControlsProps {
  dashboardRef: React.RefObject<HTMLDivElement>;
  data?: any;
}

export function ExportControls({ dashboardRef, data }: ExportControlsProps) {
  const [exporting, setExporting] = useState(false);

  const exportPDF = async () => {
    if (!dashboardRef.current) return;
    setExporting(true);
    
    try {
      const html2canvas = (await import('html2canvas')).default;
      const jsPDF = (await import('jspdf')).default;
      
      const canvas = await html2canvas(dashboardRef.current);
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('landscape', 'mm', 'a4');
      const imgWidth = pdf.internal.pageSize.getWidth();
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      
      pdf.addImage(imgData, 'PNG', 0, 0, imgWidth, imgHeight);
      pdf.save(`dashboard-${new Date().toISOString().split('T')[0]}.pdf`);
    } catch (error) {
      console.error('PDF export failed:', error);
    } finally {
      setExporting(false);
    }
  };

  const exportExcel = async () => {
    if (!data) return;
    
    try {
      const XLSX = await import('xlsx');
      const wb = XLSX.utils.book_new();
      
      if (data.kpis) {
        const kpisData = [
          ['Metric', 'Value', 'Trend'],
          ['CA Réalisé', data.kpis.ca.realise, `${data.kpis.ca.trend}%`],
          ['Marge ARS', data.kpis.margeARS.value, `${data.kpis.margeARS.trend}%`],
          ['Trésorerie', data.kpis.tresorerie.value, `${data.kpis.tresorerie.trend}%`],
        ];
        const ws = XLSX.utils.aoa_to_sheet(kpisData);
        XLSX.utils.book_append_sheet(wb, ws, 'KPIs');
      }
      
      if (data.topAffaires) {
        const ws = XLSX.utils.json_to_sheet(data.topAffaires);
        XLSX.utils.book_append_sheet(wb, ws, 'Top Affaires');
      }
      
      XLSX.writeFile(wb, `dashboard-${new Date().toISOString().split('T')[0]}.xlsx`);
    } catch (error) {
      console.error('Excel export failed:', error);
    }
  };

  return (
    <div className="flex items-center space-x-2">
      <button onClick={exportExcel} className="px-3 py-1 bg-green-100 text-green-800 rounded-lg text-sm hover:bg-green-200">
        📊 Excel
      </button>
      <button onClick={exportPDF} disabled={exporting} className="px-3 py-1 bg-red-100 text-red-800 rounded-lg text-sm hover:bg-red-200 disabled:opacity-50">
        {exporting ? '⏳ Exporting...' : '📄 PDF'}
      </button>
      <button onClick={() => window.print()} className="px-3 py-1 bg-blue-100 text-blue-800 rounded-lg text-sm hover:bg-blue-200">
        🖨️ Print
      </button>
    </div>
  );
}
