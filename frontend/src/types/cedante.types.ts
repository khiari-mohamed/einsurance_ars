export interface Cedante {
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
  codeComptableAuxiliaire?: string;
  notes?: string;
  contacts?: CedanteContact[];
  createdAt: string;
  updatedAt: string;
}

export interface CedanteContact {
  id: string;
  nom: string;
  prenom: string;
  fonction?: string;
  telephone?: string;
  mobile?: string;
  email?: string;
  principal: boolean;
  cedanteId: string;
  createdAt: string;
  updatedAt: string;
}
