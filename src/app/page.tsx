"use client";

import Image from "next/image";
import Link from "next/link";
import { useRef, type CSSProperties, type ReactNode } from "react";
import { motion, useReducedMotion, useScroll, useSpring, useTransform } from "framer-motion";
import {
  ArrowRight,
  BellRing,
  Bot,
  CheckCircle2,
  ClipboardCheck,
  CreditCard,
  FileText,
  LockKeyhole,
  PackageSearch,
  ReceiptText,
  ShieldCheck,
  Sparkles,
  Store,
  Truck,
  Users,
  WalletCards
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { UiModeToggle } from "@/components/ui-mode-toggle";

const everydayWork = [
  { icon: ReceiptText, title: "Fast billing", text: "Make a clean bill, record payment, and keep the sale history in one place." },
  { icon: PackageSearch, title: "Stock control", text: "See what is running low before the shelf is empty." },
  { icon: Users, title: "Customer dues", text: "Know who has paid, who is pending, and what needs follow-up." },
  { icon: Truck, title: "Supplier purchases", text: "Track purchases, supplier credit, and stock received without confusion." },
  { icon: FileText, title: "Beautiful reports", text: "Download simple business reports that are easy to read and share." },
  { icon: Bot, title: "AI helpers", text: "Ask ShopIQ to explain sales, prepare records, or create reports after your approval." }
];

const oldWay = [
  "Screens that feel stuck in the 90s",
  "Too many clicks for a simple bill",
  "Stock numbers that nobody fully trusts",
  "Reports that look confusing or plain",
  "No help when the shop gets busy"
];

const shopIqWay = [
  "Clean screens anyone can understand",
  "Billing, stock, customers and payments together",
  "Clear warnings before products run out",
  "Premium reports ready for real business use",
  "AI agents that help, but ask before changing records"
];

const aiJobs = [
  "Tell me what sold well this week",
  "Show customers with pending money",
  "Prepare a low stock report",
  "Create a product after I approve it",
  "Make a PDF report for the owner"
];

const dailyFlow = [
  ["Morning", "Open ShopIQ and see what needs attention today."],
  ["Billing", "Create bills quickly while stock updates in the background."],
  ["Follow-up", "Check pending dues, supplier payments and low stock."],
  ["Evening", "Review the day in a clean report instead of guessing."]
];

export default function LandingPage() {
  const heroRef = useRef<HTMLElement>(null);
  const shouldReduceMotion = useReducedMotion();
  const { scrollYProgress: pageProgress } = useScroll();
  const { scrollYProgress: heroRawProgress } = useScroll({
    target: heroRef,
    offset: ["start start", "end start"]
  });
  const smoothPageProgress = useSpring(pageProgress, { stiffness: 90, damping: 28, mass: 0.35 });
  const smoothHeroProgress = useSpring(heroRawProgress, { stiffness: 100, damping: 30, mass: 0.35 });
  const heroSceneY = useTransform(smoothHeroProgress, [0, 1], shouldReduceMotion ? [0, 0] : [0, 88]);
  const heroSceneScale = useTransform(smoothHeroProgress, [0, 1], shouldReduceMotion ? [1, 1] : [1, 0.94]);
  const heroSceneRotate = useTransform(smoothHeroProgress, [0, 1], shouldReduceMotion ? [0, 0] : [0, -2.2]);
  const heroCopyY = useTransform(smoothHeroProgress, [0, 1], shouldReduceMotion ? [0, 0] : [0, -34]);
  const heroCopyOpacity = useTransform(smoothHeroProgress, [0, 0.72, 1], shouldReduceMotion ? [1, 1, 1] : [1, 0.86, 0.6]);
  const railX = useTransform(smoothPageProgress, [0, 1], shouldReduceMotion ? ["0%", "0%"] : ["0%", "-28%"]);

  return (
    <motion.main className="landing-shell">
      <header className="landing-nav">
        <Logo />
        <nav className="landing-nav-links" aria-label="ShopIQ landing navigation">
          <a href="#work">What it does</a>
          <a href="#ai">AI agents</a>
          <a href="#flow">Daily flow</a>
        </nav>
        <div className="landing-nav-actions">
          <UiModeToggle compact className="hidden md:flex" />
          <ThemeToggle />
          <Button asChild className="hidden sm:inline-flex">
            <Link href="/login">Login</Link>
          </Button>
        </div>
      </header>

      <section className="landing-hero" ref={heroRef}>
        <motion.div
          className="landing-hero-scene"
          aria-hidden="true"
          style={{ y: heroSceneY, scale: heroSceneScale, rotate: heroSceneRotate }}
        >
          <div className="landing-product-panel landing-product-panel-main">
            <div className="landing-panel-top">
              <span>Today in your shop</span>
              <span>Live workspace</span>
            </div>
            <div className="landing-mini-grid">
              <VisualMetric label="Bills" value="Ready" tone="blue" />
              <VisualMetric label="Stock" value="Watched" tone="green" />
              <VisualMetric label="Dues" value="Clear" tone="amber" />
              <VisualMetric label="AI" value="Helping" tone="violet" />
            </div>
            <div className="landing-receipt-strip">
              <span />
              <span />
              <span />
              <strong />
            </div>
          </div>
          <div className="landing-product-panel landing-product-panel-side">
            <div className="landing-ai-mark">
              <Sparkles className="size-5" />
            </div>
            <p>ShopIQ Copilot</p>
            <strong>&quot;What needs attention before closing?&quot;</strong>
            <span>Low stock, pending dues and today&apos;s cash are ready.</span>
          </div>
          <div className="landing-product-tile landing-product-tile-a">
            <WalletCards className="size-4" />
            <span>Payments clear</span>
          </div>
          <div className="landing-product-tile landing-product-tile-b">
            <BellRing className="size-4" />
            <span>Low stock alert</span>
          </div>
        </motion.div>

        <motion.div className="landing-hero-copy" style={{ y: heroCopyY, opacity: heroCopyOpacity }}>
          <p className="landing-kicker">Premium shop management for real stores</p>
          <h1>
            <span className="landing-headline-line">Leave the 90s</span>
            <span className="landing-headline-line">software behind.</span>
          </h1>
          <p className="landing-story">
            ShopIQ gives your shop a modern, beautiful and production-ready workspace for billing,
            stock, customers, payments, staff, reports and AI agents that make daily work simpler.
          </p>
          <div className="landing-hero-actions">
            <Button size="lg" asChild>
              <Link href="/signup">
                Start your workspace
                <ArrowRight className="size-4" />
              </Link>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <Link href="/login">Open ShopIQ</Link>
            </Button>
          </div>
          <div className="landing-trust-row" aria-label="ShopIQ promises">
            <span><CheckCircle2 className="size-4" /> Simple for owners</span>
            <span><ShieldCheck className="size-4" /> Role protected</span>
            <span><LockKeyhole className="size-4" /> Approval before AI writes</span>
          </div>
        </motion.div>

        <div className="landing-motion-rail-wrap" aria-hidden="true">
          <motion.div className="landing-motion-rail" style={{ x: railX }}>
            {Array.from({ length: 2 }).map((_, groupIndex) => (
              <span key={groupIndex}>
                Billing made simple / Stock stays honest / Reports look premium / AI asks before writing / Customers and dues stay clear /
              </span>
            ))}
          </motion.div>
        </div>
      </section>

      <ScrollSection className="landing-section landing-section-tight" id="work" intensity="quiet">
        <div className="landing-section-head" data-reveal>
          <p className="landing-kicker">Made for everyday shop work</p>
          <h2>Everything your shop needs, without the clutter.</h2>
          <p>
            ShopIQ is built for people who want to run the shop, not fight with software.
            Clear screens, useful actions, and the important numbers where you expect them.
          </p>
        </div>
        <div className="landing-feature-grid">
          {everydayWork.map((item, index) => {
            const Icon = item.icon;
            return (
              <article className="landing-feature-card" data-reveal style={{ "--delay": `${index * 55}ms` } as CSSProperties} key={item.title}>
                <span className="landing-feature-icon"><Icon className="size-5" /></span>
                <h3>{item.title}</h3>
                <p>{item.text}</p>
              </article>
            );
          })}
        </div>
      </ScrollSection>

      <ScrollSection className="landing-section landing-comparison-section" intensity="deep">
        <div className="landing-comparison-copy" data-reveal>
          <p className="landing-kicker">The story is simple</p>
          <h2>Old shop software slows you down. ShopIQ keeps the shop moving.</h2>
          <p>
            You should not need dull screens, scattered notebooks, confusing reports or guesswork.
            ShopIQ brings the whole shop into one clean system that looks premium and works properly.
          </p>
        </div>
        <div className="landing-comparison-grid">
          <ComparisonCard title="The old way" items={oldWay} muted />
          <ComparisonCard title="The ShopIQ way" items={shopIqWay} />
        </div>
      </ScrollSection>

      <ScrollSection className="landing-ai-section" id="ai" intensity="normal">
        <div className="landing-ai-copy" data-reveal>
          <p className="landing-kicker">AI agents that respect your control</p>
          <h2>Ask in normal words. Approve before anything changes.</h2>
          <p>
            ShopIQ Copilot can answer business questions, prepare records, and generate reports.
            If it wants to create or update something, it shows you a preview first.
          </p>
        </div>
        <div className="landing-ai-board" data-reveal>
          <div className="landing-ai-board-head">
            <div>
              <span>ShopIQ Copilot</span>
              <strong>Practical AI for shop tasks</strong>
            </div>
            <Bot className="size-5" />
          </div>
          <div className="landing-ai-prompts">
            {aiJobs.map((job, index) => (
              <span key={job} style={{ "--delay": `${index * 70}ms` } as CSSProperties}>{job}</span>
            ))}
          </div>
          <div className="landing-ai-approval">
            <ClipboardCheck className="size-5" />
            <div>
              <strong>Preview first</strong>
              <p>No product, customer, bill or report action is saved until you approve it.</p>
            </div>
          </div>
        </div>
      </ScrollSection>

      <ScrollSection className="landing-section landing-flow-section" id="flow" intensity="quiet">
        <div className="landing-section-head" data-reveal>
          <p className="landing-kicker">A calmer day at the shop</p>
          <h2>From opening to closing, ShopIQ keeps things clear.</h2>
        </div>
        <div className="landing-flow-grid">
          {dailyFlow.map(([time, text], index) => (
            <article className="landing-flow-card" data-reveal style={{ "--delay": `${index * 80}ms` } as CSSProperties} key={time}>
              <span>{String(index + 1).padStart(2, "0")}</span>
              <h3>{time}</h3>
              <p>{text}</p>
            </article>
          ))}
        </div>
      </ScrollSection>

      <ScrollSection className="landing-showcase-section" intensity="normal">
        <div className="landing-showcase-card" data-reveal>
          <div>
            <p className="landing-kicker">Designed to feel expensive, built to do real work</p>
            <h2>Premium on the outside. Practical at the counter.</h2>
            <p>
              ShopIQ is not just a pretty landing page. The app is made for real inventory,
              real billing, real reports, real staff roles and AI-assisted work.
            </p>
          </div>
          <div className="landing-showcase-device" aria-label="ShopIQ interface preview">
            <div className="landing-device-top">
              <Image src="/favicon.png" alt="" width={64} height={64} />
              <span>ShopIQ</span>
            </div>
            <div className="landing-device-bars">
              <span />
              <span />
              <span />
              <span />
              <span />
            </div>
            <div className="landing-device-row">
              <Store className="size-4" />
              <span>Billing, stock and dues in one workspace</span>
            </div>
            <div className="landing-device-row">
              <CreditCard className="size-4" />
              <span>Payments and reports stay organized</span>
            </div>
          </div>
        </div>
      </ScrollSection>

      <ScrollSection className="landing-final-cta" intensity="quiet" reveal>
        <p className="landing-kicker">Ready when your shop is</p>
        <h2>Run the shop with less confusion and more control.</h2>
        <p>Start with a clean workspace today. Keep the counter simple, the stock honest, and the decisions easier.</p>
        <div className="landing-hero-actions">
          <Button size="lg" asChild>
            <Link href="/signup">
              Create workspace
              <ArrowRight className="size-4" />
            </Link>
          </Button>
          <Button size="lg" variant="outline" asChild>
            <Link href="/login">Login</Link>
          </Button>
        </div>
      </ScrollSection>
    </motion.main>
  );
}

function ScrollSection({
  children,
  className,
  id,
  intensity = "normal",
  reveal = false
}: {
  children: ReactNode;
  className: string;
  id?: string;
  intensity?: "quiet" | "normal" | "deep";
  reveal?: boolean;
}) {
  const ref = useRef<HTMLElement>(null);
  const shouldReduceMotion = useReducedMotion();
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start 92%", "end 14%"]
  });
  const progress = useSpring(scrollYProgress, { stiffness: 86, damping: 26, mass: 0.34 });
  const yRange = intensity === "deep" ? [58, 0, -36] : intensity === "quiet" ? [28, 0, -16] : [42, 0, -24];
  const scaleRange = intensity === "deep" ? [0.975, 1, 0.986] : [0.988, 1, 0.992];
  const y = useTransform(progress, [0, 0.48, 1], shouldReduceMotion ? [0, 0, 0] : yRange);
  const scale = useTransform(progress, [0, 0.48, 1], shouldReduceMotion ? [1, 1, 1] : scaleRange);

  return (
    <motion.section
      ref={ref}
      className={className}
      id={id}
      data-reveal={reveal || undefined}
      style={{ y, scale }}
    >
      {children}
    </motion.section>
  );
}

function VisualMetric({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <div className="landing-visual-metric" data-tone={tone}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function ComparisonCard({ title, items, muted = false }: { title: string; items: string[]; muted?: boolean }) {
  return (
    <article className="landing-comparison-card" data-muted={muted || undefined} data-reveal>
      <h3>{title}</h3>
      <ul>
        {items.map((item) => (
          <li key={item}>
            <CheckCircle2 className="size-4" />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </article>
  );
}
