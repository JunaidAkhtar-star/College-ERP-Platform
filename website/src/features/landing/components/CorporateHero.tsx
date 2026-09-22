/**
 * @file CorporateHero.tsx
 * @description Animated, responsive corporate hero with optimized image transitions.
 * @module features/landing/components
 */

'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronLeft,
  ChevronRight,
  MoveRight,
  Pause,
  Play,
} from 'lucide-react';
import { AnimatePresence, motion } from '@/shared/utils/motion';

const slides = [
  {
    image: '/images/company/hero-platform-source.png',
    alt: 'Connected cloud software product platform in a bright modern technology environment',
    eyebrow: 'Modern software products and digital solutions',
    title: 'We build software that makes progress feel natural.',
    description:
      'Devvelocity creates thoughtfully engineered products for organisations ready to simplify work, connect people and grow with confidence.',
  },
  {
    image: '/images/company/hero-team-source.png',
    alt: 'Product engineering team collaborating in a bright software design studio',
    eyebrow: 'Product thinking meets engineering discipline',
    title: 'From a difficult idea to dependable software.',
    description:
      'Strategy, experience design, cloud engineering and delivery come together as one focused product partnership.',
  },
  {
    image: '/images/company/hero-connected-source.png',
    alt: 'Cloud-connected education and business organisations in a modern sustainable campus',
    eyebrow: 'Technology with direction',
    title: 'Connected systems for organisations moving forward.',
    description:
      'We design secure platforms that bring operations, people and decisions into one clear digital experience.',
  },
  {
    image: '/images/company/hero-automation-v2.png',
    alt: 'Secure cloud automation operating in a bright contemporary business environment',
    eyebrow: 'Automation without the complexity',
    title: 'Make every workflow clearer, faster and more dependable.',
    description:
      'We connect systems, automate repetitive operations and give teams the visibility they need to move with confidence.',
  },
  {
    image: '/images/company/hero-products-v2.png',
    alt: 'A connected product ecosystem working across desktop tablet and mobile devices',
    eyebrow: 'One experience across every screen',
    title: 'Digital products people understand from the first interaction.',
    description:
      'Responsive interfaces, thoughtful product decisions and reliable engineering create software that feels natural wherever it is used.',
  },
] as const;

export default function CorporateHero() {
  const [activeIndex, setActiveIndex] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (paused || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const timer = window.setInterval(
      () => setActiveIndex((current) => (current + 1) % slides.length),
      6500,
    );
    return () => window.clearInterval(timer);
  }, [paused]);

  const active = slides[activeIndex];
  const selectSlide = (index: number) => setActiveIndex((index + slides.length) % slides.length);

  return (
    <section
      className="relative isolate min-h-[calc(100svh-65px)] overflow-hidden bg-[#eef7fc] lg:h-[calc(100dvh-65px)] lg:min-h-[560px]"
      aria-roledescription="carousel"
      aria-label="Devvelocity company introduction"
    >
      <AnimatePresence initial={false}>
        <motion.div
          key={active.image}
          initial={{ opacity: 0, x: 70, scale: 1.04 }}
          animate={{ opacity: 1, x: 0, scale: 1 }}
          exit={{ opacity: 0, x: -70, scale: 1.015 }}
          transition={{ duration: 1.3, ease: [0.22, 1, 0.36, 1] }}
          className="absolute inset-0"
        >
          <motion.div
            animate={{ scale: [1, 1.035], x: [0, -10] }}
            transition={{ duration: 7, ease: 'linear' }}
            className="absolute inset-0"
          >
            <Image
              src={active.image}
              alt={active.alt}
              fill
              priority={activeIndex === 0}
              sizes="100vw"
              className="object-cover object-[62%_center] sm:object-center"
            />
          </motion.div>
        </motion.div>
      </AnimatePresence>
      <div className="absolute inset-0 bg-linear-to-r from-white via-white/94 to-white/10 lg:via-white/76 lg:to-transparent" />
      <div className="absolute inset-0 bg-linear-to-t from-[#eef7fc]/85 via-transparent to-white/20" />

      <div className="relative mx-auto flex min-h-[calc(100svh-65px)] max-w-[1440px] items-center px-5 pb-28 pt-10 sm:pb-24 sm:pt-12 md:px-10 lg:h-full lg:min-h-0 lg:px-16 lg:py-12">
        <AnimatePresence mode="wait">
          <motion.div
            key={active.title}
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            transition={{ duration: 0.65, delay: 0.12 }}
            className="max-w-[min(46rem,78vw)] max-lg:max-w-2xl max-sm:max-w-full"
          >
            <p className="w-fit rounded-full bg-white/85 px-4 py-2 text-[10px] font-bold uppercase tracking-[0.18em] text-primary backdrop-blur-md sm:text-[11px]">
              {active.eyebrow}
            </p>
            <h1 className="mt-5 max-w-4xl text-[clamp(2.35rem,5.5vw,5.5rem)] font-semibold leading-[0.98] tracking-[-0.052em] text-[#103e60] [@media(max-height:700px)]:text-[clamp(2.2rem,4.7vw,4.5rem)]">
              {active.title}
            </h1>
            <p className="mt-5 max-w-2xl text-sm leading-6 text-[#52677a] sm:text-base sm:leading-7 lg:text-lg lg:leading-8 [@media(max-height:700px)]:mt-4">
              {active.description}
            </p>
            <div className="mt-7 flex flex-col gap-3 sm:flex-row [@media(max-height:700px)]:mt-5">
              <Link
                href="/products"
                className="inline-flex items-center justify-center gap-2 rounded-full bg-primary px-6 py-3.5 text-sm font-bold text-white transition hover:bg-primary-600"
              >
                Explore our products <ArrowRight size={17} />
              </Link>
              <Link
                href="/contact"
                className="inline-flex items-center justify-center gap-2 rounded-full bg-white/90 px-6 py-3.5 text-sm font-bold text-[#32475b] backdrop-blur-md transition hover:bg-white"
              >
                Start a conversation <MoveRight size={17} />
              </Link>
            </div>
            <div className="mt-6 flex flex-wrap gap-x-5 gap-y-2 text-xs font-semibold text-[#53687a] [@media(max-height:700px)]:hidden">
              {['Product-led delivery', 'Secure by architecture', 'Built to scale'].map((item) => (
                <span key={item} className="flex items-center gap-2">
                  <span className="grid size-5 place-items-center rounded-full bg-[#dff0b9] text-[#4f6c20]">
                    <Check size={12} />
                  </span>
                  {item}
                </span>
              ))}
            </div>
          </motion.div>
        </AnimatePresence>
      </div>

      <div className="absolute bottom-5 left-5 z-10 flex items-center gap-2 rounded-full bg-white/84 p-1.5 shadow-[0_12px_38px_rgba(18,63,97,.12)] backdrop-blur-xl md:left-10 lg:hidden">
        <button
          type="button"
          aria-label="Show previous hero slide"
          onClick={() => selectSlide(activeIndex - 1)}
          className="grid size-9 place-items-center rounded-full text-[#31526a]"
        >
          <ChevronLeft size={16} />
        </button>
        <div className="flex items-center gap-1.5">
          {slides.map((slide, index) => (
            <button
              key={slide.title}
              type="button"
              aria-label={`Show hero slide ${index + 1}`}
              aria-current={activeIndex === index}
              onClick={() => selectSlide(index)}
              className={`h-2 rounded-full transition-all duration-500 ${
                activeIndex === index ? 'w-7 bg-primary' : 'w-2 bg-[#91a7b8]'
              }`}
            />
          ))}
        </div>
        <button
          type="button"
          aria-label="Show next hero slide"
          onClick={() => selectSlide(activeIndex + 1)}
          className="grid size-9 place-items-center rounded-full text-[#31526a]"
        >
          <ChevronRight size={16} />
        </button>
      </div>

      <div className="absolute right-6 top-1/2 z-10 hidden -translate-y-1/2 lg:block xl:right-10">
        <div className="flex flex-col items-center rounded-[1.5rem] border border-white/65 bg-white/72 px-2.5 py-3 shadow-[0_18px_60px_rgba(18,63,97,.15)] backdrop-blur-xl">
          <button
            type="button"
            aria-label="Show previous hero slide"
            onClick={() => selectSlide(activeIndex - 1)}
            className="grid size-10 place-items-center rounded-full text-[#31526a] transition hover:bg-white"
          >
            <ArrowLeft size={16} />
          </button>
          <div className="my-2 flex flex-col items-center gap-2">
            {slides.map((slide, index) => (
              <button
                key={slide.title}
                type="button"
                aria-label={`Show hero slide ${index + 1}`}
                aria-current={activeIndex === index}
                onClick={() => selectSlide(index)}
                className="group flex items-center gap-2"
              >
                <span
                  className={`block w-0.5 rounded-full transition-all duration-500 ${
                    activeIndex === index ? 'h-10 bg-primary' : 'h-3 bg-[#9db0bd]'
                  }`}
                />
                <span
                  className={`text-[9px] font-bold tabular-nums transition ${
                    activeIndex === index ? 'text-primary' : 'text-[#8296a5]'
                  }`}
                >
                  {String(index + 1).padStart(2, '0')}
                </span>
              </button>
            ))}
          </div>
          <button
            type="button"
            aria-label="Show next hero slide"
            onClick={() => selectSlide(activeIndex + 1)}
            className="grid size-10 place-items-center rounded-full text-[#31526a] transition hover:bg-white"
          >
            <ArrowRight size={16} />
          </button>
        </div>
        <p className="mt-3 text-center text-[9px] font-bold uppercase tracking-[0.16em] text-[#6c8292]">
          {String(activeIndex + 1).padStart(2, '0')} / {String(slides.length).padStart(2, '0')}
        </p>
      </div>

      <div className="absolute bottom-5 right-5 z-10 md:right-10 lg:bottom-8 lg:right-10">
        <button
          type="button"
          aria-label={paused ? 'Play hero slideshow' : 'Pause hero slideshow'}
          onClick={() => setPaused((current) => !current)}
          className="grid size-10 place-items-center rounded-full bg-white/84 text-[#31526a] shadow-[0_12px_38px_rgba(18,63,97,.12)] backdrop-blur-xl"
        >
          {paused ? <Play size={16} /> : <Pause size={16} />}
        </button>
      </div>
    </section>
  );
}
