import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Edit2, Trash2, Plus, Mail, Phone, Building2, MapPin, CreditCard, FileText, FileCheck } from 'lucide-react';
import api from '../../lib/api';
import { Cedante, CedanteContact } from '../../types/cedante.types';
import { useState } from 'react';
import CedanteContactModal from './CedanteContactModal';

export default function CedanteDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [isContactModalOpen, setIsContactModalOpen] = useState(false);
  const [editingContact, setEditingContact] = useState<CedanteContact | null>(null);

  const { data: cedante, isLoading } = useQuery({
    queryKey: ['cedantes', id],
    queryFn: async () => {
      const { data } = await api.get<Cedante>(`/cedantes/${id}`);
      return data;
    },
  });

  const { data: contracts = [] } = useQuery({
    queryKey: ['cedantes', id, 'contracts'],
    queryFn: async () => {
      const { data } = await api.get(`/affaires?cedanteId=${id}`);
      return data;
    },
    enabled: !!id,
  });

  const deleteMutation = useMutation({
    mutationFn: () => api.delete(`/cedantes/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cedantes'] });
      navigate('/cedantes');
    },
  });

  const deleteContactMutation = useMutation({
    mutationFn: (contactId: string) => api.delete(`/cedantes/${id}/contacts/${contactId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cedantes', id] });
    },
  });

  const handleDelete = () => {
    if (window.confirm('Êtes-vous sûr de vouloir supprimer cette cédante ?')) {
      deleteMutation.mutate();
    }
  };

  const handleDeleteContact = (contactId: string) => {
    if (window.confirm('Êtes-vous sûr de vouloir supprimer ce contact ?')) {
      deleteContactMutation.mutate(contactId);
    }
  };

  if (isLoading) {
    return <div className="p-6">Chargement...</div>;
  }

  if (!cedante) {
    return <div className="p-6">Cédante non trouvée</div>;
  }

  return (
    <div className="p-4 lg:p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/cedantes')}
            className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="text-[24px] font-semibold text-gray-900">{cedante.raisonSociale}</h1>
            <p className="text-[13px] text-gray-500">Code: {cedante.code}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleDelete}
            className="flex items-center gap-2 px-4 py-2 text-[13px] font-medium text-red-600 hover:bg-red-50 rounded-lg transition-colors"
          >
            <Trash2 size={16} />
            Supprimer
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-2xl shadow-[0_4px_20px_rgba(0,0,0,0.04)] p-6">
            <h2 className="text-[16px] font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Building2 size={18} />
              Informations générales
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <InfoField label="Raison Sociale" value={cedante.raisonSociale} />
              <InfoField label="Forme Juridique" value={cedante.formeJuridique} />
              <InfoField label="Matricule Fiscale" value={cedante.matriculeFiscale} />
              <InfoField label="Code" value={cedante.code} />
              <InfoField label="Code Comptable Auxiliaire" value={cedante.codeComptableAuxiliaire} />
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-[0_4px_20px_rgba(0,0,0,0.04)] p-6">
            <h2 className="text-[16px] font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <MapPin size={18} />
              Coordonnées
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <InfoField label="Adresse" value={cedante.adresse} className="md:col-span-2" />
              <InfoField label="Ville" value={cedante.ville} />
              <InfoField label="Code Postal" value={cedante.codePostal} />
              <InfoField label="Pays" value={cedante.pays} />
              <InfoField label="Téléphone" value={cedante.telephone} icon={<Phone size={14} />} />
              <InfoField label="Email" value={cedante.email} icon={<Mail size={14} />} className="md:col-span-2" />
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-[0_4px_20px_rgba(0,0,0,0.04)] p-6">
            <h2 className="text-[16px] font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <CreditCard size={18} />
              Informations bancaires
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <InfoField label="RIB" value={cedante.rib} />
              <InfoField label="Banque" value={cedante.banque} />
            </div>
          </div>

          {cedante.notes && (
            <div className="bg-white rounded-2xl shadow-[0_4px_20px_rgba(0,0,0,0.04)] p-6">
              <h2 className="text-[16px] font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <FileText size={18} />
                Notes
              </h2>
              <p className="text-[13px] text-gray-600 whitespace-pre-wrap">{cedante.notes}</p>
            </div>
          )}
        </div>

        <div className="space-y-6">
          <div className="bg-white rounded-2xl shadow-[0_4px_20px_rgba(0,0,0,0.04)] p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-[16px] font-semibold text-gray-900">Contacts</h2>
              <button
                onClick={() => {
                  setEditingContact(null);
                  setIsContactModalOpen(true);
                }}
                className="p-1.5 rounded-lg hover:bg-blue-50 text-blue-600 transition-colors"
              >
                <Plus size={18} />
              </button>
            </div>
            {cedante.contacts && cedante.contacts.length > 0 ? (
              <div className="space-y-3">
                {cedante.contacts.map((contact: CedanteContact) => (
                  <div key={contact.id} className="p-3 border border-gray-100 rounded-lg hover:bg-gray-50 transition-colors">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <p className="text-[13px] font-medium text-gray-900">
                          {contact.prenom} {contact.nom}
                          {contact.principal && (
                            <span className="ml-2 text-[10px] px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full">
                              Principal
                            </span>
                          )}
                        </p>
                        {contact.fonction && (
                          <p className="text-[11px] text-gray-500">{contact.fonction}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => {
                            setEditingContact(contact);
                            setIsContactModalOpen(true);
                          }}
                          className="p-1 rounded hover:bg-blue-50 text-blue-600"
                        >
                          <Edit2 size={14} />
                        </button>
                        <button
                          onClick={() => handleDeleteContact(contact.id)}
                          className="p-1 rounded hover:bg-red-50 text-red-600"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                    {contact.email && (
                      <p className="text-[12px] text-gray-600 flex items-center gap-1 mb-1">
                        <Mail size={12} />
                        {contact.email}
                      </p>
                    )}
                    {contact.telephone && (
                      <p className="text-[12px] text-gray-600 flex items-center gap-1 mb-1">
                        <Phone size={12} />
                        {contact.telephone}
                      </p>
                    )}
                    {contact.mobile && (
                      <p className="text-[12px] text-gray-600 flex items-center gap-1">
                        <Phone size={12} />
                        {contact.mobile} (Mobile)
                      </p>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-[13px] text-gray-500 text-center py-4">Aucun contact</p>
            )}
          </div>

          <div className="bg-white rounded-2xl shadow-[0_4px_20px_rgba(0,0,0,0.04)] p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-[16px] font-semibold text-gray-900 flex items-center gap-2">
                <FileCheck size={18} />
                Contrats
              </h2>
            </div>
            {contracts.length > 0 ? (
              <div className="space-y-2">
                {contracts.map((contract: any) => (
                  <div
                    key={contract.id}
                    onClick={() => navigate(`/affaires/${contract.id}`)}
                    className="p-3 border border-gray-100 rounded-lg hover:bg-gray-50 transition-colors cursor-pointer"
                  >
                    <p className="text-[13px] font-medium text-gray-900">{contract.numeroPolice || contract.reference}</p>
                    <p className="text-[11px] text-gray-500">{contract.type}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-[13px] text-gray-500 text-center py-4">Aucun contrat</p>
            )}
          </div>
        </div>
      </div>

      {isContactModalOpen && (
        <CedanteContactModal
          cedanteId={id!}
          contact={editingContact}
          onClose={() => {
            setIsContactModalOpen(false);
            setEditingContact(null);
          }}
        />
      )}
    </div>
  );
}

interface InfoFieldProps {
  label: string;
  value?: string;
  icon?: React.ReactNode;
  className?: string;
}

function InfoField({ label, value, icon, className = '' }: InfoFieldProps) {
  return (
    <div className={className}>
      <p className="text-[11px] text-gray-500 uppercase font-medium mb-1">{label}</p>
      <p className="text-[13px] text-gray-900 flex items-center gap-1.5">
        {icon}
        {value || '-'}
      </p>
    </div>
  );
}
