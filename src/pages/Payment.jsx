import React, { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import api, { errorMessage, formatRupees, formatBookingDate, getData } from "../services/api";

const fallbackImage = "https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=1800&q=90";
const paymentMethods = [
  { id: "upi", label: "UPI", description: "Google Pay, PhonePe, Paytm" },
  { id: "card", label: "Credit / Debit Card", description: "Visa, Mastercard and more" },
  { id: "netbanking", label: "Net Banking", description: "Pay directly from your bank" },
  { id: "wallet", label: "Wallets", description: "Paytm, PhonePe, Amazon Pay" },
  { id: "payathotel", label: "Pay at Hotel", description: "Pay during check-in" }
];
const banks = ["SBI", "HDFC", "ICICI", "Axis", "Kotak", "Indian Bank"];
const wallets = ["Paytm", "PhonePe", "Amazon Pay", "Mobikwik"];
const upiApps = ["Google Pay", "PhonePe", "Paytm"];
const arrivalTimes = ["12 PM – 2 PM", "2 PM – 4 PM", "4 PM – 6 PM", "6 PM – 8 PM", "After 8 PM"];
const demoNote = <small className="demo-payment-note">Demo - no real money is charged</small>;

export default function PaymentPage() {
  const { bookingId } = useParams();
  const navigate = useNavigate();
  const [booking, setBooking] = useState(null);
  const [method, setMethod] = useState("upi");
  const [form, setForm] = useState({
    upiId: "", cardNumber: "", name: "", expiry: "", cvv: "", bank: "", wallet: "", upiApp: "",
    walletPhone: "", guestName: "", guestPhone: "", arrivalTime: ""
  });
  const [bankUserId, setBankUserId] = useState("");
  const [bankPassword, setBankPassword] = useState("");
  const [showBankPassword, setShowBankPassword] = useState(false);
  const [otp, setOtp] = useState(Array(6).fill(""));
  const otpRefs = useRef([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [phase, setPhase] = useState("payment");
  const [countdown, setCountdown] = useState(5);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    api.get("/bookings")
      .then((response) => {
        const found = (getData(response).bookings || []).find((item) => item._id === bookingId);
        if (active) {
          if (!found) setError("This booking could not be found.");
          else setBooking(found);
        }
      })
      .catch((reason) => active && setError(errorMessage(reason)))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [bookingId]);

  const completePayment = async (extra = {}) => {
    setBusy(true);
    setError("");
    try {
      await api.put(`/bookings/${bookingId}/pay`, { paymentMethod: method, ...extra });
      setPhase(method === "payathotel" ? "confirmingBooking" : "processing");
      await new Promise((resolve) => setTimeout(resolve, 2000));
      setPhase("confirmed");
      await new Promise((resolve) => setTimeout(resolve, 1400));
      navigate("/bookings", { replace: true, state: { confirmation: true, bookingId } });
    } catch (reason) {
      setError(errorMessage(reason));
      setPhase("payment");
      setBusy(false);
    }
  };

  useEffect(() => {
    if (phase !== "upiWaiting" || busy) return undefined;
    const timer = window.setTimeout(() => {
      if (countdown === 1) completePayment();
      else setCountdown(countdown - 1);
    }, 1000);
    return () => window.clearTimeout(timer);
  }, [phase, countdown, busy]);

  const selectMethod = (nextMethod) => {
    setMethod(nextMethod);
    setPhase("payment");
    setBusy(false);
    setError("");
  };

  const submit = (event) => {
    event.preventDefault();
    setError("");

    if (method === "upi") {
      if (form.upiApp) {
        setCountdown(5);
        setPhase("upiWaiting");
      } else if (/^[\w.-]+@[\w.-]+$/.test(form.upiId.trim())) {
        setCountdown(5);
        setPhase("upiWaiting");
      } else {
        setError("Enter a valid UPI ID, such as name@bank, or choose a UPI app.");
      }
      return;
    }
    if (method === "card") {
      if (!/^\d{16}$/.test(form.cardNumber)) {
        setError("Enter a valid 16-digit card number.");
        return;
      }
      if (!form.name.trim()) {
        setError("Enter the name on the card.");
        return;
      }
      const match = /^(\d{2})\/(\d{2})$/.exec(form.expiry);
      if (!match || Number(match[1]) < 1 || Number(match[1]) > 12) {
        setError("Enter a valid expiry date in MM/YY format.");
        return;
      }
      const expiryYear = 2000 + Number(match[2]);
      const now = new Date();
      if (expiryYear < now.getFullYear() || (expiryYear === now.getFullYear() && Number(match[1]) < now.getMonth() + 1)) {
        setError("The card has expired.");
        return;
      }
      if (!/^\d{3}$/.test(form.cvv)) {
        setError("Enter a valid 3-digit CVV.");
        return;
      }
      setOtp(Array(6).fill(""));
      setPhase("otp");
      return;
    }
    if (method === "netbanking") {
      if (!form.bank) {
        setError("Select a bank to continue.");
        return;
      }
      setPhase("bankLogin");
      return;
    }
    if (method === "wallet") {
      if (!form.wallet) {
        setError("Select a wallet to continue.");
        return;
      }
      if (!/^[6-9]\d{9}$/.test(form.walletPhone)) {
        setError("Enter a valid 10-digit Indian mobile number.");
        return;
      }
      setOtp(Array(6).fill(""));
      setPhase("otp");
      return;
    }
    if (method === "payathotel") {
      if (!form.guestName.trim()) {
        setError("Enter the guest name.");
        return;
      }
      if (!/^[6-9]\d{9}$/.test(form.guestPhone)) {
        setError("Enter a valid 10-digit Indian mobile number.");
        return;
      }
      if (!arrivalTimes.includes(form.arrivalTime)) {
        setError("Select your expected arrival time.");
        return;
      }
      completePayment({
        guestName: form.guestName.trim(),
        guestPhone: form.guestPhone,
        arrivalTime: form.arrivalTime
      });
    }
  };

  const submitBankLogin = (event) => {
    event.preventDefault();
    if (!bankUserId.trim() || !bankPassword) {
      setError("Enter your User ID and Password to continue.");
      return;
    }
    setBankUserId("");
    setBankPassword("");
    setOtp(Array(6).fill(""));
    setError("");
    setPhase("otp");
  };

  const updateOtp = (index, value) => {
    const digit = value.replace(/\D/g, "").slice(-1);
    const nextOtp = [...otp];
    nextOtp[index] = digit;
    setOtp(nextOtp);
    setError("");
    if (digit && index < otpRefs.current.length - 1) otpRefs.current[index + 1]?.focus();
  };

  const handleOtpKeyDown = (index, event) => {
    if (event.key === "Backspace" && !otp[index] && index > 0) otpRefs.current[index - 1]?.focus();
  };

  const verifyOtp = (event) => {
    event.preventDefault();
    if (otp.join("") !== "123456") {
      setError("Invalid OTP");
      return;
    }
    if (method === "card") {
      setForm({ ...form, cardNumber: "", name: "", expiry: "", cvv: "" });
    } else if (method === "wallet") {
      setForm({ ...form, walletPhone: "" });
    }
    completePayment(method === "netbanking" ? { bankName: form.bank } : method === "wallet" ? { walletName: form.wallet } : {});
  };

  if (loading) return <section className="section booking-page"><div className="loading-state"><span className="loader" />Loading your booking…</div></section>;
  if (!booking) return <section className="section booking-page"><div className="notice notice-error">{error}</div><Link className="underlined-link" to="/bookings">Back to My Stays</Link></section>;
  if (booking.status !== "pending" && phase === "payment") {
    return <section className="section booking-page"><div className="notice notice-error">This booking is not pending payment.</div><Link className="underlined-link" to="/bookings">Back to My Stays</Link></section>;
  }

  const amount = formatRupees(booking.totalAmount);
  if (phase === "processing" || phase === "confirmingBooking" || phase === "confirmed") {
    return (
      <section className="section booking-page payment-result">
        <div className="payment-result-card">
          {demoNote}
          {phase !== "confirmed" ? <><span className="loader" /><h1>{phase === "confirmingBooking" ? "Confirming your booking..." : "Processing payment..."}</h1></> : <><span className="payment-success-mark">✓</span><span className="eyebrow">BOOKING CONFIRMED</span><h1>Booking <em>Confirmed</em></h1><p>Your booking ID: <b>{bookingId}</b></p>{method === "payathotel" && <p>Pay at the hotel during check-in</p>}<p>Taking you to My Stays…</p></>}
        </div>
      </section>
    );
  }

  if (phase === "upiWaiting") {
    return (
      <section className="section booking-page payment-result">
        <div className="payment-result-card">
          {demoNote}
          <span className="eyebrow">UPI PAYMENT</span>
          <h1>Waiting for approval</h1>
          <p>Open your UPI app and approve the request of {amount}</p>
          <p className="payment-countdown">Completing in {countdown} seconds…</p>
          {error && <div className="notice notice-error">{error}</div>}
          <button className="button button-dark" type="button" onClick={() => { setPhase("payment"); setError(""); }}>Cancel</button>
        </div>
      </section>
    );
  }

  if (phase === "bankLogin") {
    return (
      <section className="section booking-page payment-result">
        <form className="payment-result-card payment-step-form" onSubmit={submitBankLogin}>
          {demoNote}
          <span className="eyebrow">NET BANKING</span>
          <h1>{form.bank} login</h1>
          <label className="payment-step-field">User ID<input required autoComplete="username" value={bankUserId} onChange={(event) => setBankUserId(event.target.value)} /></label>
          <label className="payment-step-field">Password<span className="password-input-wrap"><input required type={showBankPassword ? "text" : "password"} autoComplete="current-password" value={bankPassword} onChange={(event) => setBankPassword(event.target.value)} /><button className="password-toggle" type="button" aria-label={showBankPassword ? "Hide password" : "Show password"} aria-pressed={showBankPassword} onClick={() => setShowBankPassword(!showBankPassword)}><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{showBankPassword ? <><path d="M3 3l18 18" /><path d="M10.6 10.6a2 2 0 002.8 2.8" /><path d="M9.9 5.2A10.8 10.8 0 0112 5c5 0 8.5 4.5 9.5 7a11.5 11.5 0 01-3.2 4.3M6.2 6.2A12.2 12.2 0 002.5 12c1 2.5 4.5 7 9.5 7 1.2 0 2.3-.3 3.3-.7" /></> : <><path d="M2.5 12s3.5-7 9.5-7 9.5 7 9.5 7-3.5 7-9.5 7-9.5-7-9.5-7z" /><circle cx="12" cy="12" r="3" /></>}</svg></button></span></label>
          {error && <div className="notice notice-error">{error}</div>}
          <button className="button button-dark button-wide" type="submit">Login</button>
          <button className="underlined-link payment-step-cancel" type="button" onClick={() => { setPhase("payment"); setBankUserId(""); setBankPassword(""); setError(""); }}>Cancel</button>
        </form>
      </section>
    );
  }

  if (phase === "otp") {
    return (
      <section className="section booking-page payment-result">
        <form className="payment-result-card payment-step-form" onSubmit={verifyOtp}>
          {demoNote}
          <span className="eyebrow">SECURE DEMO VERIFICATION</span>
          <h1>Verify payment</h1>
          <p>Enter the 6-digit OTP sent to your registered mobile</p>
          <div className="otp-inputs" role="group" aria-label="6-digit OTP">
            {otp.map((digit, index) => (
              <input
                key={index}
                ref={(element) => { otpRefs.current[index] = element; }}
                aria-label={`OTP digit ${index + 1}`}
                autoComplete={index === 0 ? "one-time-code" : "off"}
                inputMode="numeric"
                maxLength="1"
                pattern="[0-9]"
                required
                value={digit}
                onChange={(event) => updateOtp(index, event.target.value)}
                onKeyDown={(event) => handleOtpKeyDown(index, event)}
              />
            ))}
          </div>
          <p className="otp-demo-hint">Demo OTP: 123456</p>
          {error && <div className="notice notice-error">{error}</div>}
          <button className="button button-dark button-wide" type="submit" disabled={busy}>Verify</button>
          <button className="underlined-link payment-step-cancel" type="button" onClick={() => { setPhase("payment"); setOtp(Array(6).fill("")); setError(""); }}>Cancel</button>
        </form>
      </section>
    );
  }

  return (
    <section className="section booking-page">
      <Link className="back-link" to="/bookings">← Back to My Stays</Link>
      <div className="payment-layout">
        <div className="payment-main">
          <span className="eyebrow">DEMO PAYMENT</span>
          <h1>Complete your <em>stay.</em></h1>
          {demoNote}
          <form className="booking-form payment-form" onSubmit={submit}>
            <div className="payment-method-list" role="radiogroup" aria-label="Payment method">
              {paymentMethods.map((item) => (
                <button key={item.id} type="button" role="radio" aria-checked={method === item.id} className={`payment-method-option${method === item.id ? " payment-method-selected" : ""}`} onClick={() => selectMethod(item.id)}>
                  <span className="payment-radio" aria-hidden="true" />
                  <span><b>{item.label}</b><small>{item.description}</small></span>
                </button>
              ))}
            </div>

            {method === "upi" && (
              <div className="payment-method-fields">
                <label>UPI ID<input type="text" autoComplete="off" placeholder="name@bank" value={form.upiId} onChange={(event) => setForm({ ...form, upiId: event.target.value, upiApp: "" })} /></label>
                <span className="payment-field-label">Or choose a UPI app</span>
                <div className="payment-choice-grid">{upiApps.map((app) => <button key={app} type="button" aria-pressed={form.upiApp === app} className={`payment-choice${form.upiApp === app ? " payment-choice-selected" : ""}`} onClick={() => setForm({ ...form, upiApp: app, upiId: "" })}>{app}</button>)}</div>
              </div>
            )}

            {method === "card" && (
              <div className="payment-method-fields">
                <label>Card Number<input required type="text" inputMode="numeric" autoComplete="cc-number" pattern="[0-9]{16}" maxLength="16" value={form.cardNumber} onChange={(event) => setForm({ ...form, cardNumber: event.target.value })} title="Enter a 16-digit card number." /></label>
                <label>Name on Card<input required type="text" autoComplete="cc-name" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></label>
                <div className="form-row">
                  <label>Expiry (MM/YY)<input required type="text" inputMode="numeric" autoComplete="cc-exp" placeholder="MM/YY" pattern="(0[1-9]|1[0-2])/[0-9]{2}" maxLength="5" value={form.expiry} onChange={(event) => setForm({ ...form, expiry: event.target.value })} title="Enter expiry in MM/YY format." /></label>
                  <label>CVV<input required type="password" inputMode="numeric" autoComplete="cc-csc" pattern="[0-9]{3}" maxLength="3" value={form.cvv} onChange={(event) => setForm({ ...form, cvv: event.target.value })} title="Enter a 3-digit CVV." /></label>
                </div>
              </div>
            )}

            {method === "netbanking" && (
              <div className="payment-method-fields">
                <label>Select your bank<select required value={form.bank} onChange={(event) => setForm({ ...form, bank: event.target.value })}><option value="">Choose a bank</option>{banks.map((bank) => <option key={bank}>{bank}</option>)}</select></label>
              </div>
            )}

            {method === "wallet" && (
              <div className="payment-method-fields">
                <span className="payment-field-label">Choose a wallet</span>
                <div className="payment-choice-grid">{wallets.map((wallet) => <button key={wallet} type="button" aria-pressed={form.wallet === wallet} className={`payment-choice${form.wallet === wallet ? " payment-choice-selected" : ""}`} onClick={() => setForm({ ...form, wallet })}>{wallet}</button>)}</div>
                <label>Mobile number linked to wallet<input required type="tel" inputMode="numeric" autoComplete="tel-national" pattern="[6-9][0-9]{9}" maxLength="10" placeholder="10-digit mobile number" value={form.walletPhone} onChange={(event) => setForm({ ...form, walletPhone: event.target.value.replace(/\D/g, "").slice(0, 10) })} /></label>
              </div>
            )}

            {method === "payathotel" && (
              <>
                <div className="payment-method-fields">
                  <label>Guest name<input required type="text" autoComplete="name" value={form.guestName} onChange={(event) => setForm({ ...form, guestName: event.target.value })} /></label>
                  <label>Mobile number<input required type="tel" inputMode="numeric" autoComplete="tel-national" pattern="[6-9][0-9]{9}" maxLength="10" placeholder="10-digit mobile number" value={form.guestPhone} onChange={(event) => setForm({ ...form, guestPhone: event.target.value.replace(/\D/g, "").slice(0, 10) })} /></label>
                  <label>Expected arrival time<select required value={form.arrivalTime} onChange={(event) => setForm({ ...form, arrivalTime: event.target.value })}><option value="">Choose an arrival time</option>{arrivalTimes.map((time) => <option key={time}>{time}</option>)}</select></label>
                </div>
                <p className="pay-at-hotel-note">Pay {amount} at the hotel during check-in.</p>
              </>
            )}
            {error && <div className="notice notice-error">{error}</div>}
            <button className="button button-dark button-wide" disabled={busy}>{method === "payathotel" ? "Confirm booking" : `Pay ${amount}`}</button>
          </form>
        </div>
        <aside className="booking-summary payment-summary">
          <img src={booking.hotel?.image || fallbackImage} alt="" />
          <div className="summary-content">
            <span className="eyebrow">{booking.hotel?.location || "YOUR GETAWAY"}</span>
            <h2>{booking.hotel?.name || "Hotel stay"}</h2>
            <p>{booking.room?.type} Room</p>
            <div className="summary-line"><span>Check-in</span><b>{formatBookingDate(booking.checkIn)}</b></div>
            <div className="summary-line"><span>Check-out</span><b>{formatBookingDate(booking.checkOut)}</b></div>
            {booking.isEarlyBirdApplied && booking.discountAmount > 0 && (
              <>
                <div className="summary-line summary-line-original">
                  <span>Original rate</span>
                  <del>{formatRupees(booking.originalAmount || (booking.totalAmount + booking.discountAmount))}</del>
                </div>
                <div className="summary-line summary-discount-line">
                  <span className="discount-label">Early Bird Discount ({booking.discountPercentage}%)</span>
                  <b className="discount-value">- {formatRupees(booking.discountAmount)}</b>
                </div>
                <div className="summary-earlybird-pill">
                  ⚡ Early Bird Deal Applied (Saved {formatRupees(booking.discountAmount)})
                </div>
              </>
            )}
            <div className="summary-total"><span>Total amount</span><b>{amount}</b></div>
          </div>
        </aside>
      </div>
    </section>
  );
}
