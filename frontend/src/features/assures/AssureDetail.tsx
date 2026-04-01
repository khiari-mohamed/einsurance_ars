import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Edit2, Trash2, Plus, Mail, Phone, Building2, MapPin, CreditCard, FileText, FileCheck } from 'lucide-react';
import api from '../../lib/api';
import { Assure, AssureContact } from '../../types/assure.types';
import { useState } from 'react';
import ContactModal from './ContactModal';

export default function AssureDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [isContactModalOpen, setIsContactModalOpen] = useState(false);
  const [editingContact, setEditingContact] = useState<AssureContact | null>(null);

  const { data: assure, isLoading } = useQuery({
    queryKey: ['assures', id],
    queryFn: async () => {
      const { data } = await api.get<Assure>(`/assures/${id}`);
      return data;
    },
  });

  const { data: contracts = [] } = useQuery({
    queryKey: ['assures', id, 'contracts'],
    queryFn: async () => {
      const { data } = await api.get(`/affaires?assureId=${id}`);
      return data;
    },
    enabled: !!id,
  });

  const deleteMutation = useMutation({
    mutationFn: () => api.delete(`/assures/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['assures'] });
      navigate('/assures');
    },
  });

  const deleteContactMutation = useMutation({
    mutationFn: (contactId: string) => api.delete(`/assures/${id}/contacts/${contactId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['assures', id] });
    },
  });

  const handleDelete = () => {
    if (window.confirm('Êtes-vous sûr de vouloir supprimer cet assuré ?')) {
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

  if (!assure) {
    return <div className="p-6">Assuré non trouvé</div>;
  }

  return (
    <div className="p-4 lg:p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/assures')}
            className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="text-[24px] font-semibold text-gray-900">{assure.raisonSociale}</h1>
            <p className="text-[13px] text-gray-500">Code: {assure.code}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate(`/assures/${id}/edit`)}
            className="flex items-center gap-2 px-4 py-2 text-[13px] font-medium text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
          >
            <Edit2 size={16} />
            Modifier
          </button>
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
              <InfoField label="Raison Sociale" value={assure.raisonSociale} />
              <InfoField label="Forme Juridique" value={assure.formeJuridique} />
              <InfoField label="Matricule Fiscale" value={assure.matriculeFiscale} />
              <InfoField label="Code" value={assure.code} />
              <InfoField label="Code Comptable" value={assure.codeComptable} />
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-[0_4px_20px_rgba(0,0,0,0.04)] p-6">
            <h2 className="text-[16px] font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <MapPin size={18} />
              Coordonnées
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <InfoField label="Adresse" value={assure.adresse} className="md:col-span-2" />
              <InfoField label="Ville" value={assure.ville} />
              <InfoField label="Code Postal" value={assure.codePostal} />
              <InfoField label="Pays" value={assure.pays} />
              <InfoField label="Téléphone" value={assure.telephone} icon={<Phone size={14} />} />
              <InfoField label="Email" value={assure.email} icon={<Mail size={14} />} className="md:col-span-2" />
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-[0_4px_20px_rgba(0,0,0,0.04)] p-6">
            <h2 className="text-[16px] font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <CreditCard size={18} />
              Informations bancaires
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <InfoField label="RIB" value={assure.rib} />
              <InfoField label="Banque" value={assure.banque} />
            </div>
          </div>

          {assure.notes && (
            <div className="bg-white rounded-2xl shadow-[0_4px_20px_rgba(0,0,0,0.04)] p-6">
              <h2 className="text-[16px] font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <FileText size={18} />
                Notes
              </h2>
              <p className="text-[13px] text-gray-600 whitespace-pre-wrap">{assure.notes}</p>
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
            {assure.contacts && assure.contacts.length > 0 ? (
              <div className="space-y-3">
                {assure.contacts.map((contact: AssureContact) => (
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
        <ContactModal
          assureId={id!}
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
