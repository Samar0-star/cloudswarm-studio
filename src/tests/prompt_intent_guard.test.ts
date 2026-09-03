import { LiveSwarmOrchestrator } from '../core/swarm/LiveSwarmOrchestrator';

describe('Prompt Intent Guard & Random Input Rejection', () => {
  let orchestrator: LiveSwarmOrchestrator;

  beforeEach(() => {
    orchestrator = new LiveSwarmOrchestrator();
  });

  describe('hasInfrastructureIntent', () => {
    test('rejects random gibberish and keyboard mashing', () => {
      expect(orchestrator.hasInfrastructureIntent('asdf')).toBe(false);
      expect(orchestrator.hasInfrastructureIntent('asdfghjkl')).toBe(false);
      expect(orchestrator.hasInfrastructureIntent('qwerty')).toBe(false);
      expect(orchestrator.hasInfrastructureIntent('foo bar')).toBe(false);
      expect(orchestrator.hasInfrastructureIntent('lol')).toBe(false);
      expect(orchestrator.hasInfrastructureIntent('random text')).toBe(false);
      expect(orchestrator.hasInfrastructureIntent('testing 1 2 3')).toBe(false);
    });

    test('rejects conversational filler, questions, and greetings', () => {
      expect(orchestrator.hasInfrastructureIntent('hello')).toBe(false);
      expect(orchestrator.hasInfrastructureIntent('hi there')).toBe(false);
      expect(orchestrator.hasInfrastructureIntent('what is this')).toBe(false);
      expect(orchestrator.hasInfrastructureIntent('who are you')).toBe(false);
      expect(orchestrator.hasInfrastructureIntent('can you help me')).toBe(false);
      expect(orchestrator.hasInfrastructureIntent('ok thanks')).toBe(false);
      expect(orchestrator.hasInfrastructureIntent('bye')).toBe(false);
    });

    test('accepts genuine cloud infrastructure deployment requests', () => {
      expect(
        orchestrator.hasInfrastructureIntent(
          'Deploy multi-region AWS banking core with EKS cluster, Aurora Global DB, and KMS Zero-Trust encryption'
        )
      ).toBe(true);
      expect(
        orchestrator.hasInfrastructureIntent(
          'Architect high-availability e-commerce platform with ALB, auto-scaling ECS, and Multi-AZ RDS Postgres'
        )
      ).toBe(true);
      expect(
        orchestrator.hasInfrastructureIntent('Azure VNet with Cosmos DB and AKS cluster')
      ).toBe(true);
      expect(
        orchestrator.hasInfrastructureIntent('GCP Cloud SQL with GKE Autopilot cluster')
      ).toBe(true);
      expect(
        orchestrator.hasInfrastructureIntent('Create AWS S3 bucket with KMS encryption')
      ).toBe(true);
      expect(
        orchestrator.hasInfrastructureIntent('Scale up EC2 instances to GPU')
      ).toBe(true);
    });
  });

  describe('planArchitectureFromPrompt & decomposePromptDeterministically safety', () => {
    test('returns empty plan when non-infrastructure text is provided', () => {
      const plan = orchestrator.planArchitectureFromPrompt('asdfghjkl random test');
      expect(plan.resources.length).toBe(0);
      expect(plan.edges.length).toBe(0);

      const decomp = orchestrator.decomposePromptDeterministically('asdfghjkl random test');
      expect(decomp.tasks.length).toBe(0);
      expect(decomp.architectureName).toBe('No Infrastructure Planned');
    });
  });
});
