import { useState, useEffect } from 'react';
import { Card } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { CheckCircle, XCircle, AlertCircle, Upload } from 'lucide-react';

interface DocumentChecklistItem {
  key: string;
  label: string;
  required: boolean;
  completed: boolean;
  requiredFor: string[];
}

interface DocumentChecklistProps {
  affaireId: string;
  category: 'facultative' | 'traitee';
  currentStatus: string;
  onStatusChange?: (canProgress: boolean) => void;
}

export default function DocumentChecklist({ 
  affaireId, 
  category, 
  currentStatus,
  onStatusChange 
}: DocumentChecklistProps) {
  const [checklist, setChecklist] = useState<DocumentChecklistItem[]>([]);
  const [completionRate, setCompletionRate] = useState(0);

  const checklistItems: Record<string, DocumentChecklistItem[]> = {
    facultative: [
      {
        key: 'noteSynthese',
        label: 'Note de Synthèse',
        required: true,
        completed: false,
        requiredFor: ['cotation', 'prevision', 'placement_realise'],
      },
      {
        key: 'slipCotation',
        label: 'Slip de Cotation',
        required: true,
        completed: false,
        requiredFor: ['prevision', 'placement_realise'],
      },
      {
        key: 'ordreAssurance',
        label: "Ordre d'Assurance (signed)",
        required: true,
        completed: false,
        requiredFor: ['placement_realise'],
      },
      {
        key: 'slipCouverture',
        label: 'Slip de Couverture (signed & approved)',
        required: true,
        completed: false,
        requiredFor: ['placement_realise'],
      },
      {
        key: 'bordereauCession',
        label: 'Bordereau de Cession Cédante',
        required: true,
        completed: false,
        requiredFor: ['placement_realise'],
      },
      {
        key: 'conventionCedante',
        label: 'Convention Cédante',
        required: true,
        completed: false,
        requiredFor: ['placement_realise'],
      },
      {
        key: 'conventionReassureur',
        label: 'Convention Réassureur',
        required: true,
        completed: false,
        requiredFor: ['placement_realise'],
      },
    ],
    traitee: [
      {
        key: 'noteSynthese',
        label: 'Note de Synthèse',
        required: true,
        completed: false,
        requiredFor: ['cotation', 'prevision', 'placement_realise'],
      },
      {
        key: 'slipCotation',
        label: 'Slip de Cotation',
        required: true,
        completed: false,
        requiredFor: ['prevision', 'placement_realise'],
      },
      {
        key: 'traitySigned',
        label: 'Treaty Agreement (signed)',
        required: true,
        completed: false,
        requiredFor: ['placement_realise'],
      },
      {
        key: 'slipCouverture',
        label: 'Slip de Couverture',
        required: true,
        completed: false,
        requiredFor: ['placement_realise'],
      },
      {
        key: 'conventionCedante',
        label: 'Convention Cédante',
        required: true,
        completed: false,
        requiredFor: ['placement_realise'],
      },
    ],
  };

  useEffect(() => {
    loadChecklist();
  }, [affaireId]);

  useEffect(() => {
    calculateCompletion();
  }, [checklist, currentStatus]);

  const loadChecklist = async () => {
    try {
      const response = await fetch(`/api/affaires/${affaireId}`);
      const affaire = await response.json();
      
      const items = checklistItems[category].map(item => ({
        ...item,
        completed: affaire.documentChecklist?.[item.key] || false,
      }));
      
      setChecklist(items);
    } catch (error) {
      console.error('Error loading checklist:', error);
      setChecklist(checklistItems[category]);
    }
  };

  const calculateCompletion = () => {
    const requiredForCurrentStatus = checklist.filter(item => 
      item.required && item.requiredFor.includes(currentStatus)
    );
    
    const completed = requiredForCurrentStatus.filter(item => item.completed).length;
    const total = requiredForCurrentStatus.length;
    
    const rate = total > 0 ? (completed / total) * 100 : 100;
    setCompletionRate(rate);
    
    if (onStatusChange) {
      onStatusChange(rate === 100);
    }
  };

  const toggleItem = async (key: string) => {
    try {
      const item = checklist.find(i => i.key === key);
      if (!item) return;

      const newStatus = !item.completed;
      
      await fetch(`/api/affaires/${affaireId}/checklist`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [key]: newStatus }),
      });

      setChecklist(prev => 
        prev.map(i => i.key === key ? { ...i, completed: newStatus } : i)
      );
    } catch (error) {
      console.error('Error updating checklist:', error);
    }
  };

  const getStatusIcon = (item: DocumentChecklistItem) => {
    if (item.completed) {
      return <CheckCircle className="w-5 h-5 text-green-600" />;
    }
    if (item.required && item.requiredFor.includes(currentStatus)) {
      return <AlertCircle className="w-5 h-5 text-red-600" />;
    }
    return <XCircle className="w-5 h-5 text-gray-400" />;
  };

  const getCompletionColor = () => {
    if (completionRate === 100) return 'bg-green-600';
    if (completionRate >= 50) return 'bg-yellow-600';
    return 'bg-red-600';
  };

  return (
    <Card className="p-6">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold">Document Checklist</h3>
        <div className="flex items-center gap-2">
          <div className="text-sm text-gray-600">
            {Math.round(completionRate)}% Complete
          </div>
          <div className="w-24 h-2 bg-gray-200 rounded-full overflow-hidden">
            <div 
              className={`h-full ${getCompletionColor()} transition-all`}
              style={{ width: `${completionRate}%` }}
            />
          </div>
        </div>
      </div>

      {completionRate < 100 && (
        <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
          <div className="flex items-start gap-2">
            <AlertCircle className="w-5 h-5 text-yellow-600 mt-0.5" />
            <div className="text-sm text-yellow-800">
              Some required documents are missing. Complete the checklist before progressing to the next status.
            </div>
          </div>
        </div>
      )}

      <div className="space-y-2">
        {checklist.map((item) => (
          <div 
            key={item.key}
            className={`flex items-center justify-between p-3 rounded-lg border ${
              item.completed ? 'bg-green-50 border-green-200' : 'bg-white border-gray-200'
            }`}
          >
            <div className="flex items-center gap-3 flex-1">
              {getStatusIcon(item)}
              <div>
                <div className="font-medium">{item.label}</div>
                {item.required && item.requiredFor.includes(currentStatus) && !item.completed && (
                  <div className="text-xs text-red-600">Required for current status</div>
                )}
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              {item.required && (
                <Badge variant="outline" className="text-xs">Required</Badge>
              )}
              <Button
                size="sm"
                variant={item.completed ? "outline" : "default"}
                onClick={() => toggleItem(item.key)}
              >
                <Upload className="w-4 h-4 mr-1" />
                {item.completed ? 'Uploaded' : 'Upload'}
              </Button>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
