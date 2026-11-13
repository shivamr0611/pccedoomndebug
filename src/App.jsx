import { useEffect, useMemo, useState } from 'react';
import QRCode from 'qrcode';
import paymentConfig from '../payment-config.json';

const { upiId: PAYEE_UPI_ID, amount: AMOUNT } = paymentConfig;

function paymentIntent(orderId) {
  const params = new URLSearchParams({
    pa: PAYEE_UPI_ID,
    am: AMOUNT.toFixed(2),
    cu: 'INR',
    tn: `Order ${orderId}`,
    tr: orderId,
  });
  return `upi://pay?${params}`;
}

function newOrderId() {
  return `PAY-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
}

function money(value) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
  }).format(value);
}

function dateTime(value) {
  return new Date(value).toLocaleString('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

function StatusBadge({ status }) {
  const styles = {
    success: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
    failed: 'bg-rose-50 text-rose-700 ring-rose-200',
    pending: 'bg-amber-50 text-amber-800 ring-amber-200',
  };
  const labels = { success: 'Demo successful', failed: 'Demo failed', pending: 'Demo pending' };
  return <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ring-1 ring-inset ${styles[status]}`}>{labels[status]}</span>;
}

function App() {
  const [page, setPage] = useState('checkout');
  const [orderId] = useState(newOrderId);
  const [qrImage, setQrImage] = useState('');
  const [transactions, setTransactions] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    QRCode.toDataURL(paymentIntent(orderId), {
      width: 240,
      margin: 1,
      color: { dark: '#20194c', light: '#ffffff' },
      errorCorrectionLevel: 'M',
    }).then(setQrImage).catch((qrError) => {
      setError('Could not generate the UPI QR: ' + qrError.message);
      setQrImage('');
    });
  }, [orderId]);

  async function loadTransactions() {
    const response = await fetch('/api/transactions');
    if (!response.ok) throw new Error('Could not load demo transactions.');
    setTransactions(await response.json());
  }

  useEffect(() => {
    loadTransactions().catch((loadError) => setError(loadError.message));
  }, []);

  const stats = useMemo(() => ({
    total: transactions.length,
    successful: transactions.filter((item) => item.status === 'success').length,
    failed: transactions.filter((item) => item.status === 'failed').length,
    value: transactions.reduce((sum, item) => sum + Number(item.amount || 0), 0),
  }), [transactions]);

  return (
    <div className="min-h-screen px-4 py-5 sm:px-8 sm:py-8">
      <header className="mx-auto mb-7 flex max-w-6xl items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="grid h-11 w-11 place-items-center rounded-2xl bg-gradient-to-br from-violet-600 to-blue-600 text-lg font-black text-white shadow-lg shadow-violet-200">₹</div>
          <div>
            <p className="text-lg font-extrabold tracking-tight text-slate-900">UPI Checkout</p>
            <p className="text-xs font-medium text-slate-500">Pay using your UPI app</p>
          </div>
        </div>
        <nav className="flex rounded-xl border border-violet-100 bg-white/80 p-1 shadow-sm" aria-label="Main navigation">
          {['checkout', 'transactions'].map((item) => (
            <button
              key={item}
              onClick={() => setPage(item)}
              className={`rounded-lg px-3 py-2 text-sm font-semibold capitalize transition sm:px-5 ${page === item ? 'bg-violet-600 text-white shadow' : 'text-slate-600 hover:bg-violet-50'}`}
            >
              {item === 'checkout' ? 'Checkout' : 'Transactions'}
            </button>
          ))}
        </nav>
      </header>

      <main className="mx-auto max-w-6xl">
        <div className="mb-6 flex items-center justify-between gap-3 rounded-2xl border border-violet-200 bg-violet-50/90 px-4 py-3 text-violet-950 shadow-sm">
          <div className="flex items-center gap-3">
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-violet-600 text-sm font-black text-white">₹</span>
            <p className="text-sm font-bold">UPI payment <span className="font-medium text-violet-800">· Check the payee and amount in your UPI app before approving.</span></p>
          </div>
          <span className="hidden text-xs font-semibold text-violet-700 sm:inline">{money(AMOUNT)}</span>
        </div>

        {page === 'transactions' ? (
          <Dashboard transactions={transactions} stats={stats} onBack={() => setPage('checkout')} />
        ) : (
          <Checkout
            amount={AMOUNT}
            payeeUpiId={PAYEE_UPI_ID}
            orderId={orderId}
            qrImage={qrImage}
            intent={paymentIntent(orderId)}
            error={error}
          />
        )}
      </main>
      <footer className="mx-auto mt-8 max-w-6xl text-center text-xs leading-5 text-slate-500">
        Payment is completed in your UPI app. This site cannot verify whether it succeeded; do not share your UPI PIN or OTP here.
      </footer>
    </div>
  );
}

function Checkout({ amount, payeeUpiId, orderId, qrImage, intent, error }) {
  return (
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.8fr)]">
      <section className="rounded-3xl border border-violet-100 bg-white p-5 shadow-xl shadow-violet-100/70 sm:p-8">
        <div className="mb-7 flex items-start justify-between gap-4">
          <div>
            <p className="mb-1 text-xs font-bold uppercase tracking-[0.18em] text-violet-600">UPI checkout</p>
            <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">Pay {money(amount)}</h1>
          </div>
          <span className="rounded-xl bg-blue-50 px-3 py-2 text-xs font-bold text-blue-700">UPI</span>
        </div>

        <div className="mb-7 flex items-center justify-between gap-4 rounded-2xl bg-slate-50 p-4">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Pay to this UPI ID</p>
            <p className="mt-1 break-all font-bold text-slate-900">{payeeUpiId}</p>
          </div>
          <p className="shrink-0 text-xl font-extrabold text-slate-900">{money(amount)}</p>
        </div>

        <div className="mb-6 grid grid-cols-2 gap-3 text-sm">
          <Info label="Order reference" value={orderId} />
          <Info label="Payment method" value="UPI" />
        </div>

        <div className="flex flex-col items-center rounded-2xl border border-dashed border-violet-200 bg-violet-50/60 p-5 text-center">
          {qrImage
            ? <img src={qrImage} alt={`Pay ${money(amount)} to ${payeeUpiId} using UPI`} className="mb-3 h-56 w-56 rounded-xl bg-white p-2" />
            : <p className="mb-3 py-20 text-sm text-slate-500">Generating payable UPI QR…</p>}
          <p className="text-sm font-bold text-violet-900">Scan with your UPI app</p>
          <p className="mt-1 max-w-xs break-all text-xs leading-5 text-slate-600">{payeeUpiId} · {money(amount)}</p>
        </div>

        {error && <p role="alert" className="mt-4 rounded-xl bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">{error}</p>}

        <a
          href={intent}
          className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-blue-600 px-5 py-4 text-base font-bold text-white shadow-lg shadow-violet-200 transition hover:-translate-y-0.5 hover:shadow-xl active:translate-y-0"
        >
          Open UPI app to pay {money(amount)} <span aria-hidden="true">→</span>
        </a>
        <p className="mt-4 rounded-xl bg-amber-50 px-4 py-3 text-xs leading-5 text-amber-950">
          This opens a real UPI payment. Verify the payee ID and amount in your UPI app before approving. This website cannot verify payment status. Never share your UPI PIN or OTP here.
        </p>
      </section>

      <aside className="rounded-3xl border border-violet-100 bg-white p-6 shadow-lg shadow-violet-100/50 sm:p-7">
        <div className="mb-5 flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-violet-100 text-xl text-violet-700">₹</span>
          <div>
            <h2 className="font-bold text-slate-900">Payment details</h2>
            <p className="text-xs text-slate-500">Confirm these in your UPI app</p>
          </div>
        </div>
        <div className="space-y-4 border-b border-dashed border-slate-200 pb-5 text-sm">
          <Info label="Recipient UPI ID" value={payeeUpiId} />
          <Info label="Order reference" value={orderId} />
        </div>
        <div className="flex items-center justify-between py-5">
          <span className="font-semibold text-slate-600">Amount</span>
          <span className="text-2xl font-extrabold text-slate-900">{money(amount)}</span>
        </div>
        <div className="rounded-2xl bg-amber-50 p-4 text-sm leading-6 text-amber-950">
          <p className="font-bold">Payment is external to this site</p>
          <p className="mt-1 text-xs">Only your UPI app can show whether the transfer completed. This page will not mark it successful or issue a receipt.</p>
        </div>
      </aside>
    </div>
  );
}

function Info({ label, value }) {
  return (
    <div className="min-w-0">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-1 truncate text-sm font-semibold text-slate-700">{value}</p>
    </div>
  );
}

function Dashboard({ transactions, stats, onBack }) {
  return (
    <section>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-violet-600">Admin overview · sample data only</p>
          <h1 className="mt-1 text-3xl font-extrabold tracking-tight text-slate-900">Demo samples</h1>
          <p className="mt-2 text-sm text-slate-500">Historical mock transactions only. Payable UPI transfers are not tracked or verified here.</p>
        </div>
        <button onClick={onBack} className="rounded-xl border border-violet-200 bg-white px-4 py-2.5 text-sm font-bold text-violet-700 hover:bg-violet-50">Back to checkout</button>
      </div>

      <div className="mb-7 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Total transactions" value={stats.total} accent="violet" />
        <Stat label="Successful demos" value={stats.successful} accent="emerald" />
        <Stat label="Failed demos" value={stats.failed} accent="rose" />
        <Stat label="Total simulated value" value={money(stats.value)} accent="blue" />
      </div>

      <div className="overflow-hidden rounded-3xl border border-violet-100 bg-white shadow-lg shadow-violet-100/50">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 sm:px-7">
          <div><h2 className="font-bold text-slate-900">Transaction history</h2><p className="mt-1 text-xs text-slate-500">Every entry is marked as a demo</p></div>
          <span className="rounded-full bg-violet-50 px-3 py-1 text-xs font-bold text-violet-700">DEMO</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[700px] text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr><th className="px-5 py-3 sm:px-7">Transaction</th><th className="px-5 py-3">Order</th><th className="px-5 py-3">Amount</th><th className="px-5 py-3">Method</th><th className="px-5 py-3">Date</th><th className="px-5 py-3">Status</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {transactions.map((item) => (
                <tr key={item.id} className="transition hover:bg-violet-50/40">
                  <td className="px-5 py-4 font-mono text-xs font-bold text-slate-800 sm:px-7">{item.id}<span className="ml-2 rounded bg-violet-50 px-1.5 py-0.5 font-sans text-[9px] text-violet-700">DEMO</span></td>
                  <td className="px-5 py-4 font-mono text-xs text-slate-600">{item.orderId}</td>
                  <td className="px-5 py-4 font-semibold text-slate-800">{money(item.amount)}</td>
                  <td className="px-5 py-4 capitalize text-slate-600">{item.paymentMethod}</td>
                  <td className="px-5 py-4 text-slate-600">{dateTime(item.createdAt)}</td>
                  <td className="px-5 py-4"><StatusBadge status={item.status} /></td>
                </tr>
              ))}
              {!transactions.length && <tr><td colSpan="6" className="px-6 py-12 text-center text-slate-500">No demo transactions yet. Run a checkout to add one.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

function Stat({ label, value, accent }) {
  const tones = {
    violet: 'bg-violet-50 text-violet-700',
    emerald: 'bg-emerald-50 text-emerald-700',
    rose: 'bg-rose-50 text-rose-700',
    blue: 'bg-blue-50 text-blue-700',
  };
  return (
    <div className="rounded-2xl border border-violet-100 bg-white p-5 shadow-sm">
      <span className={`grid h-9 w-9 place-items-center rounded-xl text-sm font-black ${tones[accent]}`}>D</span>
      <p className="mt-4 text-sm font-medium text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-extrabold text-slate-900">{value}</p>
    </div>
  );
}

export default App;
