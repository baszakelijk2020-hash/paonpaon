import type { CommercialProspectRepository } from '../repositories/commercial-prospect-repository';
import type { SubscriptionPlanRepository } from '../repositories/subscription-plan-repository';

export interface PipelineMetrics {
  totalExpectedMonthlyRevenueMinorUnits: number;
  totalExpectedImplementationFeeMinorUnits: number;
  byStage: Record<string, {
    count: number;
    expectedMonthlyRevenueMinorUnits: number;
    expectedImplementationFeeMinorUnits: number;
  }>;
}

export interface RevenueForecast {
  period: string; // e.g., 'next_month', 'next_quarter'
  predictedRevenueMinorUnits: number;
  confidence: number; // 0-1
}

export class RevenueMetricsService {
  constructor(
    private readonly prospectRepo: CommercialProspectRepository,
    private readonly planRepo: SubscriptionPlanRepository
  ) {}

  // Stage probabilities for weighted forecast
  private stageProbabilities: Record<string, number> = {
    lead: 0.1,
    qualification: 0.2,
    proposal: 0.5,
    negotiation: 0.75,
    'closed-won': 1.0,
    'closed-lost': 0.0
  };

  async getPipelineMetrics(): Promise<PipelineMetrics> {
    const [prospects, plans] = await Promise.all([
      this.prospectRepo.list(),
      this.planRepo.findAll()
    ]);

    // Create a map of plan ID to plan for quick lookup
    const planMap = new Map<string, SubscriptionPlan>();
    plans.forEach(plan => {
      planMap.set(plan.id, plan);
    });

    // Initialize result
    const result: PipelineMetrics = {
      totalExpectedMonthlyRevenueMinorUnits: 0,
      totalExpectedImplementationFeeMinorUnits: 0,
      byStage: {}
    };

    // Process each prospect
    prospects.forEach(prospect => {
      const stage = prospect.stage ?? 'lead'; // default to lead if not set
      const probability = this.stageProbabilities[stage] ?? 0.1;

      // Get recommended plan
      const planId = prospect.recommendedPlanId;
      const plan = planMap.get(planId ?? '');

      let monthlyPriceMinorUnits = 0;
      let implementationFeeMinorUnits = 0;

      if (plan) {
        monthlyPriceMinorUnits = plan.price.amountMinorUnits;
        implementationFeeMinorUnits = plan.implementationFee.amountMinorUnits;
      }

      // Weighted values
      const weightedMonthly = monthlyPriceMinorUnits * probability;
      const weightedImplementation = implementationFeeMinorUnits * probability;

      // Update stage totals
      if (!result.byStage[stage]) {
        result.byStage[stage] = {
          count: 0,
          expectedMonthlyRevenueMinorUnits: 0,
          expectedImplementationFeeMinorUnits: 0
        };
      }

      const stageStats = result.byStage[stage];
      stageStats.count += 1;
      stageStats.expectedMonthlyRevenueMinorUnits += weightedMonthly;
      stageStats.expectedImplementationFeeMinorUnits += weightedImplementation;

      // Update totals
      result.totalExpectedMonthlyRevenueMinorUnits += weightedMonthly;
      result.totalExpectedImplementationFeeMinorUnits += weightedImplementation;
    });

    return result;
  }

  async getRevenueForecast(period: string): Promise<RevenueForecast> {
    // For simplicity, we'll use the pipeline metrics as the forecast for now
    // In a real implementation, we would use historical data, seasonality, etc.
    const pipelineMetrics = await this.getPipelineMetrics();
    
    // For now, just return the current pipeline as the forecast for the next month
    // This is a placeholder - real forecasting would be more complex
    return {
      period,
      predictedRevenueMinorUnits: pipelineMetrics.totalExpectedMonthlyRevenueMinorUnits,
      confidence: 0.7 // Placeholder confidence
    };
  }
}