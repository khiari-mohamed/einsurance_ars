import { useState, useEffect } from 'react';
import { Card } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { CashCall, CashCallStatus, CashCallUrgency } from '../../types/cash-call.types';
import { AlertCircle, CheckCircle, Clock, Send, Phone, Mail } from 'lucide-react';

interface CashCallManagerProps {
  sinistreId: string;
}

export default function CashCallManager({ sinistreId }: CashCallManagerProps) {
  const [cashCalls, setCashCalls] = useState<CashCall[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchCashCalls();
  }, [sinistreId]);

  const fetchCashCalls = async () => {
    try {
      const response = await fetch(`/api/cash-calls?sinistreId=${sinistreId}`);
      const data = await response.json();
      setCashCalls(data);
    } catch (error) {
      console.error('Error fetching cash calls:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: CashCallStatus) => {
    const variants: Record<CashCallStatus, { color: string; icon: any }> = {
      [CashCallStatus.INITIATED]: { color: 'bg-blue-100 text-blue-800', icon: Clock },
      [CashCallStatus.SENT]: { color: 'bg-purple-100 text-purple-800', icon: Send },
      [CashCallStatus.ACKNOWLEDGED]: { color: 'bg-indigo-100 text-indigo-800', icon: CheckCircle },
      [CashCallStatus.PAID]: { color: 'bg-green-100 text-green-800', icon: CheckCircle },
      [CashCallStatus.PARTIAL]: { color: 'bg-yellow-100 text-yellow-800', icon: AlertCircle },
      [CashCallStatus.OVERDUE]: { color: 'bg-red-100 text-red-800', icon: AlertCircle },
      [CashCallStatus.CANCELLED]: { color: 'bg-gray-100 text-gray-800', icon: AlertCircle },
    };

    const { color, icon: Icon } = variants[status];
    return (
      <Badge className={color}>
        <Icon className="w-3 h-3 mr-1" />
        {status}
      </Badge>
    );
  };

  const getUrgencyBadge = (urgency: CashCallUrgency) => {
    const colors: Record<CashCallUrgency, string> = {
      [CashCallUrgency.NORMAL]: 'bg-gray-100 text-gray-800',
      [CashCallUrgency.URGENT]: 'bg-orange-100 text-orange-800',
      [CashCallUrgency.CRITICAL]: 'bg-red-100 text-red-800',
    };

    return <Badge className={colors[urgency]}>{urgency}</Badge>;
  };

  if (loading) {
    return <div className="p-4">Loading cash calls...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">Cash Calls</h3>
        <Button>
          + New Cash Call
        </Button>
      </div>

      {cashCalls.length === 0 ? (
        <Card className="p-6 text-center text-gray-500">
          No cash calls for this claim
        </Card>
      ) : (
        <div className="space-y-3">
          {cashCalls.map((cashCall) => (
            <Card key={cashCall.id} className="p-4">
              <div className="flex justify-between items-start mb-3">
                <div>
                  <div className="font-semibold text-lg">{cashCall.numero}</div>
                  <div className="text-sm text-gray-600">
                    {cashCall.reassureur?.raisonSociale}
                  </div>
                </div>
                <div className="flex gap-2">
                  {getStatusBadge(cashCall.statut)}
                  {getUrgencyBadge(cashCall.urgence)}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 mb-3">
                <div>
                  <div className="text-sm text-gray-600">Amount Requested</div>
                  <div className="font-semibold">
                    {cashCall.montantDemande.toLocaleString()} {cashCall.devise}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-gray-600">Amount Received</div>
                  <div className="font-semibold">
                    {cashCall.montantRecu.toLocaleString()} {cashCall.devise}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-gray-600">Due Date</div>
                  <div>{new Date(cashCall.dateEcheance).toLocaleDateString()}</div>
                </div>
                <div>
                  <div className="text-sm text-gray-600">Reminders Sent</div>
                  <div>{cashCall.nombreRappels}</div>
                </div>
              </div>

              <div className="mb-3">
                <div className="text-sm text-gray-600 mb-1">Reason</div>
                <div className="text-sm">{cashCall.motif}</div>
              </div>

              {cashCall.communications.length > 0 && (
                <div className="border-t pt-3">
                  <div className="text-sm font-semibold mb-2">Communications</div>
                  <div className="space-y-2">
                    {cashCall.communications.slice(-3).map((comm, idx) => (
                      <div key={idx} className="flex items-start gap-2 text-sm">
                        {comm.type === 'email' ? <Mail className="w-4 h-4" /> : <Phone className="w-4 h-4" />}
                        <div className="flex-1">
                          <div className="text-gray-600">
                            {new Date(comm.date).toLocaleDateString()} - {comm.type}
                          </div>
                          <div>{comm.message}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex gap-2 mt-3">
                <Button size="sm" variant="outline">
                  <Send className="w-4 h-4 mr-1" />
                  Send Reminder
                </Button>
                <Button size="sm" variant="outline">
                  Add Communication
                </Button>
                {cashCall.statut !== CashCallStatus.PAID && (
                  <Button size="sm">
                    Mark as Paid
                  </Button>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
