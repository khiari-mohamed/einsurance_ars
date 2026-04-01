import { useState, useEffect } from 'react';
import { Building2, Scale, Receipt, Users, CreditCard, FileText, Save } from 'lucide-react';
import { toast } from 'sonner';

interface CompanyData {
  informationsGenerales: {
    nom: string;
    raisonSociale: string;
    adresse: string;
    ville: string;
    codePostal: string;
    pays: string;
    telephone: string;
    email: string;
    siteWeb: string;
  };
  juridiques: {
    formeJuridique: string;
    capitalSocial: number;
    rne: string;
    objetSocial: string;
    representantLegal: string;
    representantLegalFonction: string;
  };
  fiscales: {
    matriculeFiscal: string;
    regimeFiscal: string;
    assujettieVAT: boolean;
    tauxVAT: number;
    autresTaxes: string;
  };
  contacts: Array<{
    nom: string;
    fonction: string;
    telephone: string;
    email: string;
  }>;
  coordonneesBancaires: Array<{
    banque: string;
    agence: string;
    rib: string;
    devise: string;
    swift: string;
  }>;
  zonesLibres: Record<string, string>;
}

export default function CompanySettingsTabs() {
  const [activeTab, setActiveTab] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [data, setData] = useState<CompanyData>({
    informationsGenerales: {
      nom: '',
      raisonSociale: '',
      adresse: '',
      ville: '',
      codePostal: '',
      pays: 'Tunisie',
      telephone: '',
      email: '',
      siteWeb: '',
    },
    juridiques: {
      formeJuridique: '',
      capitalSocial: 0,
      rne: '',
      objetSocial: '',
      representantLegal: '',
      representantLegalFonction: '',
    },
    fiscales: {
      matriculeFiscal: '',
      regimeFiscal: '',
      assujettieVAT: true,
      tauxVAT: 19,
      autresTaxes: '',
    },
    contacts: [],
    coordonneesBancaires: [],
    zonesLibres: {},
  });

  const tabs = [
    { id: 0, label: 'Informations Générales', icon: Building2 },
    { id: 1, label: 'Juridiques', icon: Scale },
    { id: 2, label: 'Fiscales', icon: Receipt },
    { id: 3, label: 'Contacts', icon: Users },
    { id: 4, label: 'Coordonnées Bancaires', icon: CreditCard },
    { id: 5, label: 'Zones Libres', icon: FileText },
  ];

  useEffect(() => {
    fetchCompanySettings();
  }, []);

  const fetchCompanySettings = async () => {
    try {
      const res = await fetch('/api/system/company-settings');
      if (res.ok) {
        const settings = await res.json();
        setData(settings);
      }
    } catch (error) {
      console.error('Error fetching settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/system/company-settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (res.ok) {
        toast.success('Paramètres enregistrés avec succès');
      } else {
        toast.error('Erreur lors de l\'enregistrement');
      }
    } catch (error) {
      toast.error('Erreur lors de l\'enregistrement');
    } finally {
      setSaving(false);
    }
  };

  const addContact = () => {
    setData({
      ...data,
      contacts: [...data.contacts, { nom: '', fonction: '', telephone: '', email: '' }],
    });
  };

  const removeContact = (index: number) => {
    setData({
      ...data,
      contacts: data.contacts.filter((_, i) => i !== index),
    });
  };

  const addBankAccount = () => {
    setData({
      ...data,
      coordonneesBancaires: [...data.coordonneesBancaires, { banque: '', agence: '', rib: '', devise: 'TND', swift: '' }],
    });
  };

  const removeBankAccount = (index: number) => {
    setData({
      ...data,
      coordonneesBancaires: data.coordonneesBancaires.filter((_, i) => i !== index),
    });
  };

  if (loading) {
    return <div className="p-6 text-center">Chargement...</div>;
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="bg-white rounded-lg shadow-lg">
        {/* Tabs Header */}
        <div className="border-b">
          <div className="flex overflow-x-auto">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-6 py-4 border-b-2 transition-colors whitespace-nowrap ${
                    activeTab === tab.id
                      ? 'border-blue-600 text-blue-600 bg-blue-50'
                      : 'border-transparent text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                  }`}
                >
                  <Icon size={18} />
                  <span className="font-medium">{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Tab Content */}
        <div className="p-6">
          {/* Tab 0: Informations Générales */}
          {activeTab === 0 && (
            <div className="space-y-4">
              <h3 className="text-lg font-bold mb-4">Informations Générales</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Nom Commercial</label>
                  <input
                    type="text"
                    value={data.informationsGenerales.nom}
                    onChange={(e) => setData({ ...data, informationsGenerales: { ...data.informationsGenerales, nom: e.target.value } })}
                    className="w-full px-3 py-2 border rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Raison Sociale</label>
                  <input
                    type="text"
                    value={data.informationsGenerales.raisonSociale}
                    onChange={(e) => setData({ ...data, informationsGenerales: { ...data.informationsGenerales, raisonSociale: e.target.value } })}
                    className="w-full px-3 py-2 border rounded-lg"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-medium mb-1">Adresse</label>
                  <input
                    type="text"
                    value={data.informationsGenerales.adresse}
                    onChange={(e) => setData({ ...data, informationsGenerales: { ...data.informationsGenerales, adresse: e.target.value } })}
                    className="w-full px-3 py-2 border rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Ville</label>
                  <input
                    type="text"
                    value={data.informationsGenerales.ville}
                    onChange={(e) => setData({ ...data, informationsGenerales: { ...data.informationsGenerales, ville: e.target.value } })}
                    className="w-full px-3 py-2 border rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Code Postal</label>
                  <input
                    type="text"
                    value={data.informationsGenerales.codePostal}
                    onChange={(e) => setData({ ...data, informationsGenerales: { ...data.informationsGenerales, codePostal: e.target.value } })}
                    className="w-full px-3 py-2 border rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Pays</label>
                  <input
                    type="text"
                    value={data.informationsGenerales.pays}
                    onChange={(e) => setData({ ...data, informationsGenerales: { ...data.informationsGenerales, pays: e.target.value } })}
                    className="w-full px-3 py-2 border rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Téléphone</label>
                  <input
                    type="text"
                    value={data.informationsGenerales.telephone}
                    onChange={(e) => setData({ ...data, informationsGenerales: { ...data.informationsGenerales, telephone: e.target.value } })}
                    className="w-full px-3 py-2 border rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Email</label>
                  <input
                    type="email"
                    value={data.informationsGenerales.email}
                    onChange={(e) => setData({ ...data, informationsGenerales: { ...data.informationsGenerales, email: e.target.value } })}
                    className="w-full px-3 py-2 border rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Site Web</label>
                  <input
                    type="text"
                    value={data.informationsGenerales.siteWeb}
                    onChange={(e) => setData({ ...data, informationsGenerales: { ...data.informationsGenerales, siteWeb: e.target.value } })}
                    className="w-full px-3 py-2 border rounded-lg"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Tab 1: Juridiques */}
          {activeTab === 1 && (
            <div className="space-y-4">
              <h3 className="text-lg font-bold mb-4">Informations Juridiques</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Forme Juridique</label>
                  <select
                    value={data.juridiques.formeJuridique}
                    onChange={(e) => setData({ ...data, juridiques: { ...data.juridiques, formeJuridique: e.target.value } })}
                    className="w-full px-3 py-2 border rounded-lg"
                  >
                    <option value="">Sélectionner...</option>
                    <option value="SARL">SARL</option>
                    <option value="SA">SA</option>
                    <option value="SUARL">SUARL</option>
                    <option value="SNC">SNC</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Capital Social (TND)</label>
                  <input
                    type="number"
                    value={data.juridiques.capitalSocial}
                    onChange={(e) => setData({ ...data, juridiques: { ...data.juridiques, capitalSocial: parseFloat(e.target.value) } })}
                    className="w-full px-3 py-2 border rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">RNE (Identifiant Unique) *</label>
                  <input
                    type="text"
                    value={data.juridiques.rne}
                    onChange={(e) => setData({ ...data, juridiques: { ...data.juridiques, rne: e.target.value } })}
                    className="w-full px-3 py-2 border rounded-lg"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Représentant Légal</label>
                  <input
                    type="text"
                    value={data.juridiques.representantLegal}
                    onChange={(e) => setData({ ...data, juridiques: { ...data.juridiques, representantLegal: e.target.value } })}
                    className="w-full px-3 py-2 border rounded-lg"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-medium mb-1">Fonction</label>
                  <input
                    type="text"
                    value={data.juridiques.representantLegalFonction}
                    onChange={(e) => setData({ ...data, juridiques: { ...data.juridiques, representantLegalFonction: e.target.value } })}
                    className="w-full px-3 py-2 border rounded-lg"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-medium mb-1">Objet Social</label>
                  <textarea
                    value={data.juridiques.objetSocial}
                    onChange={(e) => setData({ ...data, juridiques: { ...data.juridiques, objetSocial: e.target.value } })}
                    className="w-full px-3 py-2 border rounded-lg"
                    rows={4}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Tab 2: Fiscales */}
          {activeTab === 2 && (
            <div className="space-y-4">
              <h3 className="text-lg font-bold mb-4">Informations Fiscales</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Matricule Fiscal *</label>
                  <input
                    type="text"
                    value={data.fiscales.matriculeFiscal}
                    onChange={(e) => setData({ ...data, fiscales: { ...data.fiscales, matriculeFiscal: e.target.value } })}
                    className="w-full px-3 py-2 border rounded-lg"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Régime Fiscal</label>
                  <select
                    value={data.fiscales.regimeFiscal}
                    onChange={(e) => setData({ ...data, fiscales: { ...data.fiscales, regimeFiscal: e.target.value } })}
                    className="w-full px-3 py-2 border rounded-lg"
                  >
                    <option value="">Sélectionner...</option>
                    <option value="reel">Régime Réel</option>
                    <option value="forfaitaire">Régime Forfaitaire</option>
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={data.fiscales.assujettieVAT}
                      onChange={(e) => setData({ ...data, fiscales: { ...data.fiscales, assujettieVAT: e.target.checked } })}
                      className="w-4 h-4"
                    />
                    <span className="text-sm font-medium">Assujettie à la TVA</span>
                  </label>
                </div>
                {data.fiscales.assujettieVAT && (
                  <div>
                    <label className="block text-sm font-medium mb-1">Taux TVA (%)</label>
                    <input
                      type="number"
                      value={data.fiscales.tauxVAT}
                      onChange={(e) => setData({ ...data, fiscales: { ...data.fiscales, tauxVAT: parseFloat(e.target.value) } })}
                      className="w-full px-3 py-2 border rounded-lg"
                    />
                  </div>
                )}
                <div className="col-span-2">
                  <label className="block text-sm font-medium mb-1">Autres Taxes Applicables</label>
                  <textarea
                    value={data.fiscales.autresTaxes}
                    onChange={(e) => setData({ ...data, fiscales: { ...data.fiscales, autresTaxes: e.target.value } })}
                    className="w-full px-3 py-2 border rounded-lg"
                    rows={3}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Tab 3: Contacts */}
          {activeTab === 3 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold">Contacts</h3>
                <button
                  onClick={addContact}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  + Ajouter Contact
                </button>
              </div>
              <div className="space-y-4">
                {data.contacts.map((contact, index) => (
                  <div key={index} className="p-4 border rounded-lg">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium mb-1">Nom</label>
                        <input
                          type="text"
                          value={contact.nom}
                          onChange={(e) => {
                            const newContacts = [...data.contacts];
                            newContacts[index].nom = e.target.value;
                            setData({ ...data, contacts: newContacts });
                          }}
                          className="w-full px-3 py-2 border rounded-lg"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-1">Fonction</label>
                        <input
                          type="text"
                          value={contact.fonction}
                          onChange={(e) => {
                            const newContacts = [...data.contacts];
                            newContacts[index].fonction = e.target.value;
                            setData({ ...data, contacts: newContacts });
                          }}
                          className="w-full px-3 py-2 border rounded-lg"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-1">Téléphone</label>
                        <input
                          type="text"
                          value={contact.telephone}
                          onChange={(e) => {
                            const newContacts = [...data.contacts];
                            newContacts[index].telephone = e.target.value;
                            setData({ ...data, contacts: newContacts });
                          }}
                          className="w-full px-3 py-2 border rounded-lg"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-1">Email</label>
                        <input
                          type="email"
                          value={contact.email}
                          onChange={(e) => {
                            const newContacts = [...data.contacts];
                            newContacts[index].email = e.target.value;
                            setData({ ...data, contacts: newContacts });
                          }}
                          className="w-full px-3 py-2 border rounded-lg"
                        />
                      </div>
                    </div>
                    <button
                      onClick={() => removeContact(index)}
                      className="mt-2 text-red-600 text-sm hover:underline"
                    >
                      Supprimer
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Tab 4: Coordonnées Bancaires */}
          {activeTab === 4 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold">Coordonnées Bancaires ARS</h3>
                <button
                  onClick={addBankAccount}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  + Ajouter Compte
                </button>
              </div>
              <div className="space-y-4">
                {data.coordonneesBancaires.map((account, index) => (
                  <div key={index} className="p-4 border rounded-lg">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium mb-1">Banque</label>
                        <input
                          type="text"
                          value={account.banque}
                          onChange={(e) => {
                            const newAccounts = [...data.coordonneesBancaires];
                            newAccounts[index].banque = e.target.value;
                            setData({ ...data, coordonneesBancaires: newAccounts });
                          }}
                          className="w-full px-3 py-2 border rounded-lg"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-1">Agence</label>
                        <input
                          type="text"
                          value={account.agence}
                          onChange={(e) => {
                            const newAccounts = [...data.coordonneesBancaires];
                            newAccounts[index].agence = e.target.value;
                            setData({ ...data, coordonneesBancaires: newAccounts });
                          }}
                          className="w-full px-3 py-2 border rounded-lg"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-1">RIB</label>
                        <input
                          type="text"
                          value={account.rib}
                          onChange={(e) => {
                            const newAccounts = [...data.coordonneesBancaires];
                            newAccounts[index].rib = e.target.value;
                            setData({ ...data, coordonneesBancaires: newAccounts });
                          }}
                          className="w-full px-3 py-2 border rounded-lg"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-1">Devise</label>
                        <select
                          value={account.devise}
                          onChange={(e) => {
                            const newAccounts = [...data.coordonneesBancaires];
                            newAccounts[index].devise = e.target.value;
                            setData({ ...data, coordonneesBancaires: newAccounts });
                          }}
                          className="w-full px-3 py-2 border rounded-lg"
                        >
                          <option value="TND">TND</option>
                          <option value="USD">USD</option>
                          <option value="EUR">EUR</option>
                        </select>
                      </div>
                      <div className="col-span-2">
                        <label className="block text-sm font-medium mb-1">SWIFT/BIC</label>
                        <input
                          type="text"
                          value={account.swift}
                          onChange={(e) => {
                            const newAccounts = [...data.coordonneesBancaires];
                            newAccounts[index].swift = e.target.value;
                            setData({ ...data, coordonneesBancaires: newAccounts });
                          }}
                          className="w-full px-3 py-2 border rounded-lg"
                        />
                      </div>
                    </div>
                    <button
                      onClick={() => removeBankAccount(index)}
                      className="mt-2 text-red-600 text-sm hover:underline"
                    >
                      Supprimer
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Tab 5: Zones Libres */}
          {activeTab === 5 && (
            <div className="space-y-4">
              <h3 className="text-lg font-bold mb-4">Zones Libres (Champs Personnalisés)</h3>
              <p className="text-sm text-gray-600 mb-4">
                Ajoutez des champs personnalisés pour stocker des informations spécifiques à votre entreprise.
              </p>
              <div className="space-y-3">
                {Object.entries(data.zonesLibres).map(([key, value]) => (
                  <div key={key} className="grid grid-cols-3 gap-4">
                    <input
                      type="text"
                      value={key}
                      disabled
                      className="px-3 py-2 border rounded-lg bg-gray-50"
                    />
                    <input
                      type="text"
                      value={value}
                      onChange={(e) => {
                        const newZones = { ...data.zonesLibres };
                        newZones[key] = e.target.value;
                        setData({ ...data, zonesLibres: newZones });
                      }}
                      className="col-span-2 px-3 py-2 border rounded-lg"
                    />
                  </div>
                ))}
                <button
                  onClick={() => {
                    const newKey = prompt('Nom du champ:');
                    if (newKey) {
                      setData({ ...data, zonesLibres: { ...data.zonesLibres, [newKey]: '' } });
                    }
                  }}
                  className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
                >
                  + Ajouter Champ
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Save Button */}
        <div className="border-t p-6 flex justify-end">
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            <Save size={18} />
            {saving ? 'Enregistrement...' : 'Enregistrer'}
          </button>
        </div>
      </div>
    </div>
  );
}
