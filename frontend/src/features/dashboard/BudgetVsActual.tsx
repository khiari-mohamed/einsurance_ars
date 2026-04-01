import { useState, useEffect, createElement } from 'react';
import { Card } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { TrendingUp, TrendingDown, Target, DollarSign } from 'lucide-react';

interface BudgetData {
  year: number;
  budgetByCedant: Record<string, number>;
  budgetByReassureur: Record<string, number>;
  budgetByBranch: Record<string, number>;
  totalBudget: number;
}

interface ActualData {
  totalRevenue: number;
  revenueByCedant: Record<string, number>;
  revenueByReassureur: Record<string, number>;
  revenueByBranch: Record<string, number>;
}

export default function BudgetVsActualDashboard() {
  const [year, setYear] = useState(new Date().getFullYear());
  const [budget, setBudget] = useState<BudgetData | null>(null);
  const [actual, setActual] = useState<ActualData | null>(null);
  const [loading, setLoading] = useState(true);
  const [editMode, setEditMode] = useState(false);

  useEffect(() => {
    fetchData();
  }, [year]);

  const fetchData = async () => {
    try {
      const [budgetRes, actualRes] = await Promise.all([
        fetch(`/api/reporting/budget/${year}`),
        fetch(`/api/reporting/actual/${year}`),
      ]);

      const budgetData = await budgetRes.json();
      const actualData = await actualRes.json();

      setBudget(budgetData);
      setActual(actualData);
    } catch (error) {
      console.error('Error fetching budget data:', error);
    } finally {
      setLoading(false);
    }
  };

  const calculateVariance = (actual: number, budget: number) => {
    if (budget === 0) return 0;
    return ((actual - budget) / budget) * 100;
  };

  const getVarianceColor = (variance: number) => {
    if (variance >= 0) return 'text-green-600';
    if (variance >= -10) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getVarianceIcon = (variance: number) => {
    return variance >= 0 ? TrendingUp : TrendingDown;
  };

  if (loading) {
    return <div className="p-4">Loading budget data...</div>;
  }

  const totalVariance = budget && actual 
    ? calculateVariance(actual.totalRevenue, budget.totalBudget)
    : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Budget vs Actual</h2>
          <p className="text-gray-600">Annual performance tracking</p>
        </div>
        <div className="flex gap-2">
          <Input
            type="number"
            value={year}
            onChange={(e) => setYear(parseInt(e.target.value))}
            className="w-24"
          />
          <Button onClick={() => setEditMode(!editMode)}>
            {editMode ? 'View Mode' : 'Edit Budget'}
          </Button>
        </div>
      </div>

      {/* Overall Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-6">
          <div className="flex items-center justify-between mb-2">
            <div className="text-sm text-gray-600">Total Budget</div>
            <Target className="w-5 h-5 text-blue-600" />
          </div>
          <div className="text-2xl font-bold">
            {budget?.totalBudget.toLocaleString()} TND
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between mb-2">
            <div className="text-sm text-gray-600">Actual Revenue</div>
            <DollarSign className="w-5 h-5 text-green-600" />
          </div>
          <div className="text-2xl font-bold">
            {actual?.totalRevenue.toLocaleString()} TND
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between mb-2">
            <div className="text-sm text-gray-600">Variance</div>
            {createElement(getVarianceIcon(totalVariance), {
              className: `w-5 h-5 ${getVarianceColor(totalVariance)}`,
            })}
          </div>
          <div className={`text-2xl font-bold ${getVarianceColor(totalVariance)}`}>
            {totalVariance >= 0 ? '+' : ''}{totalVariance.toFixed(1)}%
          </div>
        </Card>
      </div>

      {/* By Cedant */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Performance by Cedant</h3>
        <div className="space-y-3">
          {budget && actual && Object.keys(budget.budgetByCedant).map((cedant) => {
            const budgetAmount = budget.budgetByCedant[cedant] || 0;
            const actualAmount = actual.revenueByCedant[cedant] || 0;
            const variance = calculateVariance(actualAmount, budgetAmount);
            const achievement = budgetAmount > 0 ? (actualAmount / budgetAmount) * 100 : 0;

            return (
              <div key={cedant} className="border-b pb-3 last:border-0">
                <div className="flex justify-between items-center mb-2">
                  <div className="font-medium">{cedant}</div>
                  <div className={`text-sm font-semibold ${getVarianceColor(variance)}`}>
                    {variance >= 0 ? '+' : ''}{variance.toFixed(1)}%
                  </div>
                </div>
                <div className="flex justify-between text-sm text-gray-600 mb-2">
                  <span>Budget: {budgetAmount.toLocaleString()} TND</span>
                  <span>Actual: {actualAmount.toLocaleString()} TND</span>
                </div>
                <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className={`h-full ${achievement >= 100 ? 'bg-green-600' : achievement >= 75 ? 'bg-yellow-600' : 'bg-red-600'}`}
                    style={{ width: `${Math.min(achievement, 100)}%` }}
                  />
                </div>
                <div className="text-xs text-gray-600 mt-1">
                  {achievement.toFixed(0)}% achieved
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      {/* By Branch */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Performance by Branch</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {budget && actual && Object.keys(budget.budgetByBranch).map((branch) => {
            const budgetAmount = budget.budgetByBranch[branch] || 0;
            const actualAmount = actual.revenueByBranch[branch] || 0;
            const variance = calculateVariance(actualAmount, budgetAmount);

            return (
              <div key={branch} className="border rounded-lg p-4">
                <div className="text-sm font-semibold mb-2">{branch}</div>
                <div className="text-xs text-gray-600 mb-1">
                  Budget: {budgetAmount.toLocaleString()}
                </div>
                <div className="text-xs text-gray-600 mb-2">
                  Actual: {actualAmount.toLocaleString()}
                </div>
                <div className={`text-sm font-bold ${getVarianceColor(variance)}`}>
                  {variance >= 0 ? '+' : ''}{variance.toFixed(1)}%
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      {/* Export Button */}
      <div className="flex justify-end">
        <Button>
          Export Report (PDF/Excel)
        </Button>
      </div>
    </div>
  );
}
