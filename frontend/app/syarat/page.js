'use client';
import { TermsContent } from '@/components/Terms';

export default function TermsPage() {
  return (
    <div className="narrow">
      <div className="page-head">
        <div>
          <h1>Syarat & Ketentuan</h1>
          <p>Aturan bersama supaya nebeng tetap aman untuk pemilik mobil dan penumpang.</p>
        </div>
      </div>
      <div className="card">
        <TermsContent />
      </div>
    </div>
  );
}
