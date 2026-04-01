import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { importExportApi } from '@/api/slips';
import { toast } from 'sonner';
import { Download, Upload } from 'lucide-react';

export default function ImportExport() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const importMutation = useMutation({
    mutationFn: (file: File) => importExportApi.importAffaires(file),
    onSuccess: (response) => {
      const data = (response as any).data;
      toast.success(`${data.success} affaires importées`);
      if (data.errors && data.errors.length > 0) {
        toast.warning(`${data.errors.length} erreurs détectées`);
      }
      setSelectedFile(null);
    },
  });

  const handleExport = async (type: string) => {
    try {
      let response;
      if (type === 'affaires') response = await importExportApi.exportAffaires();
      else if (type === 'sinistres') response = await importExportApi.exportSinistres();
      else if (type === 'finances') response = await importExportApi.exportFinances('2024-01-01', '2024-12-31');

      if (response) {
        const blob = (response as any).data;
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `export_${type}_${Date.now()}.xlsx`;
        a.click();
        toast.success('Export réussi');
      }
    } catch (error) {
      toast.error('Erreur lors de l\'export');
    }
  };

  const handleDownloadTemplate = async (type: string) => {
    try {
      const response = await importExportApi.downloadTemplate(type);
      const blob = (response as any).data;
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `template_${type}.xlsx`;
      a.click();
      toast.success('Template téléchargé');
    } catch (error) {
      toast.error('Erreur lors du téléchargement');
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Export de Données</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4">
            <Button onClick={() => handleExport('affaires')} className="flex items-center gap-2">
              <Download size={16} />
              Exporter Affaires
            </Button>
            <Button onClick={() => handleExport('sinistres')} className="flex items-center gap-2">
              <Download size={16} />
              Exporter Sinistres
            </Button>
            <Button onClick={() => handleExport('finances')} className="flex items-center gap-2">
              <Download size={16} />
              Exporter Finances
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Import de Données</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">Télécharger un template</label>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => handleDownloadTemplate('affaires')}>
                  Template Affaires
                </Button>
                <Button variant="outline" onClick={() => handleDownloadTemplate('cedantes')}>
                  Template Cédantes
                </Button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Importer un fichier</label>
              <div className="flex gap-2">
                <input
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                  className="border rounded px-3 py-2 flex-1"
                />
                <Button
                  onClick={() => selectedFile && importMutation.mutate(selectedFile)}
                  disabled={!selectedFile || importMutation.isPending}
                  className="flex items-center gap-2"
                >
                  <Upload size={16} />
                  {importMutation.isPending ? 'Import...' : 'Importer'}
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
