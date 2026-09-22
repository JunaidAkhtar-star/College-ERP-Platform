'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { motion, AnimatePresence } from '@/shared/utils/motion';
import {
  ArrowLeft,
  ArrowRight,
  Zap,
  CheckCircle,
  Clock,
  Server,
  Lock,
  Menu,
  X,
} from 'lucide-react';
import useMutation from '@/shared/hooks/useMutation';
import { toast } from 'react-toastify';

interface IDemoForm {
  name: string;
  email: string;
  phone: string;
  collegeName: string;
  designation: string;
  studentCount: string;
  message: string;
}

export default function DemoPage() {
  const { mutation, isLoading } = useMutation();
  const [form, setForm] = useState<IDemoForm>({
    name: '',
    email: '',
    phone: '',
    collegeName: '',
    designation: 'Principal',
    studentCount: '2000',
    message: '',
  });
  const [submitted, setSubmitted] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.email || !form.phone || !form.collegeName) {
      toast.error('Please fill in all required fields.');
      return;
    }
    const res = await mutation('super-admin/leads', {
      method: 'POST',
      body: {
        name: form.name,
        email: form.email,
        phone: form.phone,
        collegeName: form.collegeName,
        designation: form.designation,
        studentCount: Number(form.studentCount) || 0,
      },
    });
    if (res?.results?.success) {
      toast.success("Demo request submitted! We'll reach out within 24 hours.");
      setSubmitted(true);
    }
  };

  return (
    <div
      className="min-h-screen bg-white text-slate-900"
      style={{ fontFamily: "'Inter', 'Segoe UI', system-ui, sans-serif" }}
    >
      {/* ── HEADER ─────────────────────────────────────────────────────── */}
      <header
        className="hidden"
        style={{
          background: 'rgba(255, 255, 255, 0.92)',
          backdropFilter: 'blur(16px)',
          borderBottom: '1px solid rgba(0,0,0,0.06)',
        }}
      >
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2.5 group">
            <Zap className="w-5.5 h-5.5 text-indigo-600 shrink-0" />
            <div>
              <span className="text-lg font-extrabold text-slate-900 tracking-tight">
                Devvelocity
              </span>
              <span className="hidden sm:inline-block ml-2 text-[10px] font-bold text-indigo-600 bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded-full uppercase tracking-wider">
                ERP
              </span>
            </div>
          </Link>

          {/* Desktop Nav */}
          <nav className="hidden md:flex items-center gap-8">
            {[
              { label: 'Features', href: '/#features' },
              { label: 'Modules', href: '/modules' },
              { label: 'Pricing', href: '/#pricing' },
              { label: 'Contact', href: '/contact' },
            ].map((item) => (
              <Link
                key={item.label}
                href={item.href}
                className="text-sm font-semibold text-slate-600 hover:text-indigo-600 transition-colors"
              >
                {item.label}
              </Link>
            ))}
          </nav>

          {/* CTA */}
          <div className="flex items-center gap-3">
            <Link
              href={process.env.NEXT_PUBLIC_ADMIN_URL || 'https://admin.devvelocity.in'}
              className="hidden md:inline-flex items-center text-sm font-semibold text-slate-655 hover:text-indigo-650 transition-colors px-3 py-2"
            >
              Sign In
            </Link>
            <Link
              href="/demo"
              className="hidden md:inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white rounded-xl transition-all duration-300 hover:shadow-lg hover:shadow-indigo-500/25 hover:-translate-y-0.5"
              style={{
                background: 'linear-gradient(135deg, #4f46e5, #7c3aed)',
              }}
            >
              Get Demo <ArrowRight className="w-3.5 h-3.5" />
            </Link>
            <button
              className="md:hidden p-2 rounded-xl text-slate-600 hover:bg-slate-100 transition-colors"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Mobile menu */}
        <AnimatePresence>
          {mobileMenuOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="md:hidden border-t border-slate-100 px-6 py-4 space-y-3 bg-white/95 backdrop-blur-xl"
            >
              {[
                { label: 'Features', href: '/#features' },
                { label: 'Modules', href: '/modules' },
                { label: 'Pricing', href: '/#pricing' },
                { label: 'Contact', href: '/contact' },
              ].map((item, i) => (
                <Link
                  key={i}
                  href={item.href}
                  className="block text-sm font-medium text-slate-600 hover:text-slate-900 py-2"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  {item.label}
                </Link>
              ))}
              <Link
                href="/demo"
                className="block text-center py-3 rounded-xl font-semibold text-white"
                style={{ background: 'linear-gradient(135deg, #4f46e5, #7c3aed)' }}
                onClick={() => setMobileMenuOpen(false)}
              >
                Get Demo
              </Link>
              <Link
                href={process.env.NEXT_PUBLIC_ADMIN_URL || 'https://admin.devvelocity.in'}
                className="block text-center py-3 rounded-xl font-semibold text-slate-700 bg-slate-50 hover:bg-slate-100 transition-all border border-slate-200"
                onClick={() => setMobileMenuOpen(false)}
              >
                Sign In
              </Link>
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      {/* ── HERO ─────────────────────────────────────────────────────── */}
      <section
        className="relative py-20 px-6 text-center overflow-hidden"
        style={{
          background: 'linear-gradient(180deg, rgba(79,70,229,0.06) 0%, transparent 100%)',
        }}
      >
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              'radial-gradient(ellipse 70% 60% at 50% 0%, rgba(79,70,229,0.06), transparent)',
          }}
        />
        <div className="relative max-w-3xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <div
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs font-bold text-indigo-700 mb-6"
              style={{
                background: 'rgba(79,70,229,0.08)',
                border: '1px solid rgba(79,70,229,0.15)',
              }}
            >
              <Zap className="w-3.5 h-3.5" /> <span>Dedicated Sandbox Environment</span>
            </div>
            <h1 className="text-4xl md:text-5xl font-extrabold text-slate-900 mb-5 leading-tight">
              Request Your Personalized
              <br />
              <span
                style={{
                  background: 'linear-gradient(135deg, #4f46e5, #7c3aed)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text',
                }}
              >
                Sandbox Demo
              </span>
            </h1>
            <p className="text-slate-500 text-lg leading-relaxed max-w-2xl mx-auto">
              Experience the full power of Devvelocity ERP with a pre-configured sandbox containing
              mock student data tailored to your institution. Ready in under 24 hours.
            </p>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.75, delay: 0.18, ease: [0.22, 1, 0.36, 1] }}
            className="relative mt-10 aspect-[16/9] overflow-hidden rounded-[2rem] bg-blue-50"
          >
            <Image
              src="/images/public-pages/demo-guided-workspace.png"
              alt="Devvelocity specialist guiding college leaders through an ERP product demonstration"
              fill
              priority
              sizes="(max-width: 768px) 92vw, 768px"
              className="object-cover"
            />
            <motion.div
              animate={{ y: [0, -7, 0] }}
              transition={{ duration: 4.5, repeat: Infinity, ease: 'easeInOut' }}
              className="absolute bottom-5 left-5 rounded-2xl bg-white/90 px-4 py-3 text-left backdrop-blur-sm"
            >
              <p className="text-xs font-black text-[#0178d7]">Guided around your workflows</p>
              <p className="mt-1 text-[10px] font-semibold text-[#667085]">
                No generic sales script · Real institutional scenarios
              </p>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* ── MAIN CONTENT ─────────────────────────────────────────────── */}
      <section className="max-w-7xl mx-auto px-6 py-10 pb-28">
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-16 items-start">
          {/* ─ Left: Core Features and Trust Points ─ */}
          <div className="lg:col-span-2 space-y-8">
            <div>
              <h2 className="text-2xl font-extrabold text-slate-900 mb-3">Why Request a Demo?</h2>
              <p className="text-slate-500 text-sm leading-relaxed">
                See how a modern, unified cloud portal simplifies student lifecycles, compliance,
                and accounting.
              </p>
            </div>

            {/* Benefit cards */}
            {[
              {
                icon: Server,
                color: '#4f46e5',
                label: 'SaaS Cloud & On-Premise Sandbox',
                desc: 'Explore the administrator, teacher, and student portals simultaneously.',
              },
              {
                icon: Clock,
                color: '#059669',
                label: 'Setup in 24 Hours',
                desc: 'No complex requirements. We provision your sandbox with loaded sample data.',
              },
              {
                icon: Lock,
                color: '#d97706',
                label: 'Dedicated Database Isolation',
                desc: 'See how our multi-tenant database isolation ensures ironclad security.',
              },
            ].map((card, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.1 }}
                className="flex items-start gap-4 p-5 rounded-2xl bg-white"
                style={{
                  border: '1px solid rgba(0,0,0,0.06)',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.01)',
                }}
              >
                <div
                  className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
                  style={{ background: `${card.color}10`, border: `1px solid ${card.color}20` }}
                >
                  <card.icon className="w-5 h-5" style={{ color: card.color }} />
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-900">{card.label}</p>
                  <p className="text-xs text-slate-500 mt-1 leading-relaxed">{card.desc}</p>
                </div>
              </motion.div>
            ))}

            <div className="flex items-center gap-2 pt-2 text-xs font-semibold text-slate-500">
              <CheckCircle className="h-4 w-4 text-emerald-600" /> Institution-specific product
              walkthrough
            </div>
          </div>

          {/* ─ Right: Form ─ */}
          <div className="lg:col-span-3">
            <div
              className="p-10 rounded-3xl bg-white"
              style={{
                border: '1px solid rgba(0,0,0,0.06)',
                boxShadow: '0 10px 40px rgba(0,0,0,0.02)',
              }}
            >
              <h2 className="text-2xl font-extrabold text-slate-900 mb-2">
                Request Sandbox Access
              </h2>
              <p className="text-slate-500 text-sm mb-8">
                Fill in the form below. Our support team will provision your secure sandbox portal
                and send credentials.
              </p>

              <AnimatePresence mode="wait">
                {submitted ? (
                  <motion.div
                    key="success"
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="text-center py-16"
                  >
                    <div
                      className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6"
                      style={{
                        background: 'rgba(5,150,105,0.08)',
                        border: '1px solid rgba(5,150,105,0.15)',
                      }}
                    >
                      <CheckCircle className="w-10 h-10 text-emerald-600" />
                    </div>
                    <h3 className="text-2xl font-bold text-slate-900 mb-3">Request Received!</h3>
                    <p className="text-slate-500 text-sm max-w-sm mx-auto leading-relaxed">
                      Thank you. We have received your request. An onboarding engineer will contact
                      you shortly with your credentials.
                    </p>
                    <Link
                      href="/"
                      className="inline-flex items-center gap-2 mt-8 px-6 py-3 rounded-xl text-sm font-semibold text-indigo-700 hover:bg-slate-50 transition-colors"
                      style={{
                        border: '1px solid rgba(79,70,229,0.25)',
                        background: 'rgba(79,70,229,0.04)',
                      }}
                    >
                      <ArrowLeft className="w-4 h-4" /> Back to Home
                    </Link>
                  </motion.div>
                ) : (
                  <motion.form
                    key="form"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    onSubmit={handleSubmit}
                    className="space-y-5"
                  >
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                      {[
                        {
                          field: 'name' as const,
                          label: 'Full Name *',
                          placeholder: 'Dr. Rajesh Kumar',
                          type: 'text',
                        },
                        {
                          field: 'email' as const,
                          label: 'Official Email *',
                          placeholder: 'you@university.edu',
                          type: 'email',
                        },
                        {
                          field: 'phone' as const,
                          label: 'Phone Number *',
                          placeholder: '+91 98765 43210',
                          type: 'tel',
                        },
                        {
                          field: 'collegeName' as const,
                          label: 'College / University *',
                          placeholder: 'e.g. Anna University',
                          type: 'text',
                        },
                      ].map((f) => (
                        <div key={f.field}>
                          <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">
                            {f.label}
                          </label>
                          <input
                            type={f.type}
                            required
                            placeholder={f.placeholder}
                            className="w-full rounded-xl px-4 py-3 text-sm text-slate-800 bg-slate-50 border border-slate-200 outline-none transition-all focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 placeholder-slate-400"
                            value={form[f.field]}
                            onChange={(e) => setForm({ ...form, [f.field]: e.target.value })}
                          />
                        </div>
                      ))}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">
                          Designation
                        </label>
                        <select
                          className="w-full rounded-xl px-4 py-3 text-sm text-slate-800 bg-slate-50 border border-slate-200 outline-none transition-all focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500"
                          value={form.designation}
                          onChange={(e) => setForm({ ...form, designation: e.target.value })}
                        >
                          {[
                            'Principal',
                            'Dean Academic',
                            'HOD / Department Chair',
                            'IT Administrator',
                            'Faculty Member',
                          ].map((d) => (
                            <option key={d} value={d}>
                              {d}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">
                          Student Strength
                        </label>
                        <select
                          className="w-full rounded-xl px-4 py-3 text-sm text-slate-800 bg-slate-50 border border-slate-200 outline-none transition-all focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500"
                          value={form.studentCount}
                          onChange={(e) => setForm({ ...form, studentCount: e.target.value })}
                        >
                          {[
                            ['500', 'Under 1,000'],
                            ['2000', '1,000 – 5,000'],
                            ['7500', '5,000 – 10,000'],
                            ['20000', 'Above 10,000'],
                          ].map(([v, l]) => (
                            <option key={v} value={v}>
                              {l}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">
                        Message / Specific Requirements
                      </label>
                      <textarea
                        rows={4}
                        placeholder="Tell us about your specific requirements, timeline, or any questions..."
                        className="w-full rounded-xl px-4 py-3 text-sm text-slate-800 bg-slate-50 border border-slate-200 outline-none transition-all focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 resize-none placeholder-slate-400"
                        value={form.message}
                        onChange={(e) => setForm({ ...form, message: e.target.value })}
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={isLoading}
                      className="w-full flex items-center justify-center gap-3 py-4 rounded-xl font-bold text-white text-base transition-all duration-300 hover:shadow-lg hover:shadow-indigo-500/20 hover:-translate-y-0.5 disabled:opacity-60"
                      style={{ background: 'linear-gradient(135deg, #4f46e5, #7c3aed)' }}
                    >
                      {isLoading ? (
                        <span className="animate-pulse">Submitting request...</span>
                      ) : (
                        <>
                          Submit Demo Request <ArrowRight className="w-4 h-4" />
                        </>
                      )}
                    </button>
                  </motion.form>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="hidden" style={{ borderTop: '1px solid #e2e8f0', background: '#f8fafc' }}>
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-12 mb-16">
            <div className="md:col-span-2">
              <div className="flex items-center gap-2 mb-5">
                <Zap className="w-5.5 h-5.5 text-indigo-600 shrink-0" />
                <span className="text-lg font-extrabold text-slate-900 tracking-tight">
                  Devvelocity ERP
                </span>
              </div>
              <p className="text-sm text-slate-500 leading-relaxed max-w-xs">
                The modern cloud ERP platform purpose-built for higher education institutions across
                India.
              </p>
              <div className="flex items-center gap-2 mt-6">
                <span className="text-xs text-slate-400 font-medium">
                  Status: All systems operational
                </span>
              </div>
            </div>

            {[
              {
                heading: 'Product',
                links: [
                  ['Features', '/#features'],
                  ['Modules', '/modules'],
                  ['Pricing', '/#pricing'],
                  ['Security', '/#features'],
                ],
              },
              {
                heading: 'Modules',
                links: [
                  ['LMS & Academics', '/modules/academics'],
                  ['Fee Management', '/modules/fees'],
                  ['NAAC & IQAC', '/modules/naac-iqac'],
                  ['Examinations', '/modules/examinations'],
                ],
              },
              {
                heading: 'Company',
                links: [
                  ['About Us', '#'],
                  ['Contact', '/contact'],
                  ['Privacy Policy', '#'],
                  ['Terms of Service', '#'],
                ],
              },
            ].map((col) => (
              <div key={col.heading}>
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-5">
                  {col.heading}
                </h4>
                <ul className="space-y-3">
                  {col.links.map(([label, href]) => (
                    <li key={label}>
                      <Link
                        href={href}
                        className="text-sm text-slate-500 hover:text-slate-900 transition-colors"
                      >
                        {label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          <div
            className="flex flex-col md:flex-row items-center justify-between gap-4 pt-8"
            style={{ borderTop: '1px solid #e2e8f0' }}
          >
            <p className="text-xs text-slate-400">
              © {new Date().getFullYear()} Devvelocity Ltd. All rights reserved.
            </p>
            <p className="text-xs text-slate-400">Built for Modern Education · Made in India 🇮🇳</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
