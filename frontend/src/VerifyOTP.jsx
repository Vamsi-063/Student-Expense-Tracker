
import React, { useState } from "react";
import API from "./services/api";

function VerifyOTP({ email, onVerified, onBack }) {
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const handleVerify = async (e) => {
    e.preventDefault();

    setError("");
    setSuccess("");

    if (!/^\d{6}$/.test(otp)) {
      setError("Please enter a valid 6-digit OTP.");
      return;
    }

    try {
      setLoading(true);

      const response = await API.post("/auth/verify-otp", {
        email,
        otp
      });

      setSuccess(response.data.message);

      setTimeout(() => {
        onVerified();
      }, 1000);

    } catch (err) {
      setError(
        err.response?.data?.error || "OTP verification failed."
      );
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setError("");
    setSuccess("");

    try {
      setResending(true);

      const response = await API.post("/auth/resend-otp", {
        email
      });

      setSuccess(response.data.message);
      setOtp("");

    } catch (err) {
      setError(
        err.response?.data?.error || "Could not resend OTP."
      );
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        <div className="otp-icon">✉️</div>

        <h1>Verify Your Email</h1>

        <p>
          We've sent a 6-digit verification code to:
          <br />
          <strong className="otp-email">{email}</strong>
        </p>

        <form onSubmit={handleVerify}>
          <label>Enter Verification Code</label>

          <input
            type="text"
            inputMode="numeric"
            maxLength="6"
            placeholder="000000"
            value={otp}
            onChange={(e) =>
              setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))
            }
            autoComplete="one-time-code"
          />

          {error && <div className="auth-error">{error}</div>}

          {success && (
            <div className="auth-success">{success}</div>
          )}

          <button
            type="submit"
            className="auth-submit"
            disabled={loading}
          >
            {loading ? "Verifying..." : "Verify Email"}
          </button>
        </form>

        <div className="otp-resend">
          Didn't receive the code?

          <button
            type="button"
            onClick={handleResend}
            disabled={resending}
          >
            {resending ? "Sending..." : "Resend OTP"}
          </button>
        </div>

        <div className="auth-switch">
          <button type="button" onClick={onBack}>
            ← Back to Signup
          </button>
        </div>
      </div>
    </div>
  );
}

export default VerifyOTP;
