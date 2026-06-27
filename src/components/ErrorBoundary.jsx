import { supabase } from '@/lib/supabaseClient';
import React from 'react';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    // Log to Supabase audit log silently
    supabase.from('audit_logs').insert({ action: 'RUNTIME_ERROR', entity: 'frontend', new_value: { message: error.message, stack: error.stack?.slice(0,500) } }).catch(() => {});
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center p-6 bg-slate-50" dir="rtl">
          <div className="max-w-md w-full text-center space-y-6">
            <div className="text-6xl">⚠️</div>
            <h1 className="text-2xl font-black text-slate-800">حدث خطأ غير متوقع</h1>
            <p className="text-slate-500 text-sm">نعتذر عن هذا الخطأ. تم تسجيله تلقائياً.</p>
            <div className="flex gap-3 justify-center">
              <button
                onClick={() => this.setState({ hasError: false, error: null })}
                className="px-4 py-2 bg-slate-800 text-white rounded-lg text-sm hover:bg-slate-700"
              >
                حاول مجدداً
              </button>
              <button
                onClick={() => window.location.href = '/'}
                className="px-4 py-2 border border-slate-200 rounded-lg text-sm hover:bg-slate-50"
              >
                الصفحة الرئيسية
              </button>
            </div>
            {import.meta.env.DEV && (
              <pre className="text-left text-xs text-red-600 bg-red-50 p-3 rounded-lg overflow-auto max-h-40">
                {this.state.error?.message}
              </pre>
            )}
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
