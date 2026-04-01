export interface Assure {
  id: string;
  code: string;
  raisonSociale: string;
  formeJuridique?: string;
  adresse?: string;
  ville?: string;
  codePostal?: string;
  pays?: string;
  telephone?: string;
  email?: string;
  matriculeFiscale?: string;
  rib?: string;
  banque?: string;
  notes?: string;
  codeComptable?: string;
  contacts?: AssureContact[];
  createdAt: string;
  updatedAt: string;
}

export interface AssureContact {
  id: string;
  nom: string;
  prenom: string;
  fonction?: string;
  telephone?: string;
  mobile?: string;
  email?: string;
  principal: boolean;
  assureId: string;
  createdAt: string;
  updatedAt: string;
}
