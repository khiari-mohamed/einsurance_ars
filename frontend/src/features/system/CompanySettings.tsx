export default function CompanySettings() {
  return (
    <div className="p-8">
      <h1 className="font-display text-3xl font-semibold text-foreground mb-6">Paramètres Société</h1>
      <div className="bg-card p-6 rounded-[var(--radius)] border border-border max-w-2xl">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Nom de la société</label>
            <input type="text" defaultValue="ARS TUNISIE" className="w-full px-4 py-2 border rounded" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Devise par défaut</label>
            <select className="w-full px-4 py-2 border rounded">
              <option>TND</option>
              <option>EUR</option>
              <option>USD</option>
            </select>
          </div>
          <button className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
            Enregistrer
          </button>
        </div>
      </div>
    </div>
  );
}
