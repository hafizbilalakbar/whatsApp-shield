import React from 'react';
import { MotionConfig } from 'framer-motion';
import { cn } from '../components/ui/cn';
import {
  HeroSection, TrustStrip,
  LeadGenSection, LeadToCustomerFlow,
  AudienceSelector, AutomationSection, AiSection, ProductPreview, MetricsSection,
  TestimonialsSection, BrandsSection, FaqSection, FinalCta,
} from '../components/landing/sections';
import { SectionHeading } from '../components/landing/shared';
import { ShieldShowcase, AgentShowcase } from '../components/landing/showcases';
import { GlobalDiscovery } from '../components/landing/discovery';
import { GoalWorkflowSection } from '../components/landing/goalWorkflow';
import { Badge } from '../components/ui/Badge';

const BadgeLanding = ({ children }) => (
  <Badge variant="outline" className="mb-3 text-[11px] px-3 py-1 text-primary border-primary/30 bg-primary/5">{children}</Badge>
);

const Section = ({ band = false, id, className, children }) => (
  <section
    id={id}
    className={cn(
      'w-full py-10 sm:py-14 px-4 sm:px-6 lg:px-8',
      band && 'bg-surface border-t border-border',
      className
    )}
  >
    <div className="app-container">{children}</div>
  </section>
);

const LandingPage = () => {
  return (
    <MotionConfig reducedMotion="user">
      <div className="w-full flex flex-col items-center overflow-x-clip">
        {/* 1 · Hero */}
        <HeroSection />

        {/* 2 · Trust strip */}
        <Section>
          <TrustStrip />
        </Section>

        {/* 3 · WhatsApp Shield — animated product showcase */}
        <Section band id="whatsapp-shield">
          <ShieldShowcase />
        </Section>

        {/* 4 · Message Agent — animated product showcase */}
        <Section id="message-agent">
          <AgentShowcase />
        </Section>

        {/* 5 · Start with a goal — full-bleed pinned cinematic section */}
        <GoalWorkflowSection />

        {/* 6 · Lead discovery — animated showcase */}
        <Section>
          <div className="max-w-2xl mx-auto text-center mb-6 sm:mb-8">
            <BadgeLanding>Lead Discovery</BadgeLanding>
            <h2 className="text-xl sm:text-2xl lg:text-3xl font-display font-bold mb-2 leading-tight">Find Your Next Business Opportunity</h2>
            <p className="text-sm sm:text-base text-text-secondary leading-relaxed">
              Pick a market, watch the radar scan for relevant audiences, and move validated leads into outreach — in seconds.
            </p>
          </div>
          <GlobalDiscovery />
        </Section>

        {/* 7 · Lead generation pipeline */}
        <Section>
          <LeadGenSection />
        </Section>

        {/* 8 · From lead discovery to customer conversation */}
        <Section band id="features">
          <SectionHeading
            eyebrow="The Workflow"
            badge="Lead → Customer"
            title="From Lead Discovery to Customer Conversation"
            subtitle="One connected pipeline — from finding an audience to organized follow-up."
          />
          <LeadToCustomerFlow />
        </Section>

        {/* 9 · Multiple audiences */}
        <Section band>
          <SectionHeading
            eyebrow="Built For You"
            title="One Platform. Multiple Business Audiences."
            subtitle="The same workflow adapts to the leads you work with every day."
          />
          <AudienceSelector />
        </Section>

        {/* 10 · Automation */}
        <Section>
          <AutomationSection />
        </Section>

        {/* 11 · AI assistance */}
        <Section band>
          <AiSection />
        </Section>

        {/* 12 · Product preview */}
        <Section>
          <ProductPreview />
        </Section>

        {/* 13 · Metrics */}
        <Section band>
          <MetricsSection />
        </Section>

        {/* 14 · Testimonials */}
        <Section>
          <TestimonialsSection />
        </Section>

        {/* 15 · Brands */}
        <Section band>
          <BrandsSection />
        </Section>

        {/* 16 · FAQ */}
        <Section id="faq">
          <FaqSection />
        </Section>

        {/* 17 · Final CTA */}
        <Section className="relative overflow-hidden">
          <div className="absolute inset-0 dark:mesh-gradient-dark mesh-gradient-light opacity-60" aria-hidden="true" />
          <FinalCta />
        </Section>
      </div>
    </MotionConfig>
  );
};

export default LandingPage;