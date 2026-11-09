import React, { useState, useEffect } from 'react';
import { Terminal, CheckCircle2, XCircle, AlertCircle, Copy, Send, RefreshCw, Code2 } from 'lucide-react';
import { api } from '../api/client';

export default function RegexSandbox() {
  const [inputRecord, setInputRecord] = useState('2026-11-09T10:30:00,HOST001,125.50,UPLOAD');
  const [validationResult, setValidationResult] = useState(null);
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitFeedback, setSubmitFeedback] = useState(null);
  const [invalidLogs, setInvalidLogs] = useState([]);
  const [isLoadingLogs, setIsLoadingLogs] = useState(false);

  const sampleCases = [
    { label: 'Valid Standard Record', value: '2026-11-09T10:30:00,HOST001,125.50,UPLOAD', type: 'valid' },
    { label: 'Valid Zero Bandwidth', value: '2026-01-01T00:00:00,SRV-GATEWAY,0.00,DOWNLOAD', type: 'valid' },
    { label: 'Invalid Month (13)', value: '2026-13-09T10:30:00,HOST001,100.00,UPLOAD', type: 'invalid' },
    { label: 'Invalid Symbols in Host ID', value: '2026-11-09T10:30:00,H@ST!01,100.00,UPLOAD', type: 'invalid' },
    { label: 'Negative Bandwidth', value: '2026-11-09T10:30:00,HOST001,-50.00,UPLOAD', type: 'invalid' },
    { label: 'Alphabetic Bandwidth', value: '2026-11-09T10:30:00,HOST001,UNLIMITED,UPLOAD', type: 'invalid' },
    { label: 'Excess Decimal Precision', value: '2026-11-09T10:30:00,HOST001,12.345,UPLOAD', type: 'invalid' },
    { label: 'Missing Fields', value: '2026-11-09T10:30:00,HOST001,120.00', type: 'invalid' },
    { label: 'Extra Trailing Fields', value: '2026-11-09T10:30:00,HOST001,120.00,UPLOAD,GARBAGE', type: 'invalid' }
  ];

  const handleValidateOnly = async (textToValidate) => {
    setIsEvaluating(true);
    setSubmitFeedback(null);
    try {
      const res = await api.validateOnly({ rawRecord: textToValidate });
      setValidationResult(res.result);
    } catch (err) {
      setValidationResult({
        isValid: false,
        rawRecord: textToValidate,
        errors: [err.message || 'Validation request failed']
      });
    } finally {
      setIsEvaluating(false);
    }
  };

  const handleSubmitToPipeline = async () => {
    setIsSubmitting(true);
    setSubmitFeedback(null);
    try {
      const res = await api.submitRecord(inputRecord);
      setSubmitFeedback({
        success: true,
        message: `Accepted! Host ${res.data?.hostId} classified into state: ${res.hostState}`,
        data: res
      });
      loadInvalidLogs();
    } catch (err) {
      setSubmitFeedback({
        success: false,
        message: err.data?.error || err.message,
        details: err.data?.validationErrors || []
      });
      loadInvalidLogs();
    } finally {
      setIsSubmitting(false);
    }
  };

  const loadInvalidLogs = async () => {
    setIsLoadingLogs(true);
    try {
      const res = await api.getInvalidRecords(20);
      setInvalidLogs(res.data || []);
    } catch {
      // Ignored
    } finally {
      setIsLoadingLogs(false);
    }
  };

  useEffect(() => {
    handleValidateOnly(inputRecord);
    loadInvalidLogs();
  }, []);

  return (
    <div className="space-y-6">
      
      {/* Educational Theory Banner */}
      <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-6 backdrop-blur-sm shadow-xl">
        <div className="flex items-center space-x-2.5 mb-2">
          <Code2 className="w-5 h-5 text-indigo-400" />
          <h2 className="text-base font-bold font-mono text-slate-100">
            Academic Concept A: Regular Expression Validation Engine
          </h2>
        </div>
        <p className="text-xs text-slate-300 leading-relaxed font-sans mb-4">
          All network telemetry ingested by the system must strictly adhere to the formal CSV schema. The engine uses a dual-tier validation strategy: a fast Master Regex for $O(N)$ match assertion, backed by surgical diagnostic regexes to provide clear, actionable rejection explanations.
        </p>

        {/* Master Regex Code Block */}
        <div className="p-3.5 bg-slate-950 border border-slate-800/80 rounded-xl overflow-x-auto font-mono text-xs text-indigo-300">
          <code>
            ^(\d&#123;4&#125;-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\d|3[01])T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d),([A-Z0-9_-]&#123;3,16&#125;),(\d+(?:\.\d&#123;1,2&#125;)?),(UPLOAD|DOWNLOAD)$
          </code>
        </div>
      </div>

      {/* Interactive Testing Sandbox */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Input & Presets Column */}
        <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-5 backdrop-blur-sm shadow-xl flex flex-col justify-between">
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider font-mono text-slate-200 mb-2">
              Interactive Record Input
            </h3>
            
            <textarea
              rows={3}
              value={inputRecord}
              onChange={(e) => {
                setInputRecord(e.target.value);
                handleValidateOnly(e.target.value);
              }}
              placeholder="YYYY-MM-DDTHH:mm:ss,HOST_ID,BANDWIDTH,DIRECTION"
              className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs font-mono text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/30 mb-3"
            />

            {/* Quick Test Preset Buttons */}
            <label className="text-[11px] font-mono font-semibold text-slate-400 block mb-2">
              Load Preset Test Cases:
            </label>
            <div className="flex flex-wrap gap-1.5 mb-4">
              {sampleCases.map((sc, idx) => (
                <button
                  key={idx}
                  onClick={() => {
                    setInputRecord(sc.value);
                    handleValidateOnly(sc.value);
                  }}
                  className={`text-[10px] font-mono px-2 py-1 rounded-lg border transition-all ${
                    sc.type === 'valid'
                      ? 'border-emerald-900/60 bg-emerald-950/20 text-emerald-300 hover:bg-emerald-900/40'
                      : 'border-rose-900/60 bg-rose-950/20 text-rose-300 hover:bg-rose-900/40'
                  }`}
                >
                  {sc.label}
                </button>
              ))}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center space-x-2 pt-3 border-t border-slate-800/80">
            <button
              onClick={() => handleValidateOnly(inputRecord)}
              disabled={isEvaluating}
              className="flex-1 py-2 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-all flex items-center justify-center space-x-1.5"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isEvaluating ? 'animate-spin' : ''}`} />
              <span>Validate Only</span>
            </button>

            <button
              onClick={handleSubmitToPipeline}
              disabled={isSubmitting}
              className="flex-1 py-2 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white shadow-md shadow-indigo-600/30 transition-all flex items-center justify-center space-x-1.5"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Submit to Pipeline</span>
            </button>
          </div>
        </div>

        {/* Validation Diagnostic Output Column */}
        <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-5 backdrop-blur-sm shadow-xl flex flex-col justify-between">
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider font-mono text-slate-200 mb-3 flex items-center justify-between">
              <span>Validation Outcome</span>
              {validationResult && (
                <span
                  className={`inline-flex items-center space-x-1 text-xs px-2.5 py-0.5 rounded-full font-bold font-mono ${
                    validationResult.isValid
                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                      : 'bg-rose-500/20 text-rose-400 border border-rose-500/40'
                  }`}
                >
                  {validationResult.isValid ? (
                    <>
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>SYNTACTICALLY VALID</span>
                    </>
                  ) : (
                    <>
                      <XCircle className="w-3.5 h-3.5" />
                      <span>MALFORMED REJECTED</span>
                    </>
                  )}
                </span>
              )}
            </h3>

            {/* Diagnostic Details */}
            {validationResult?.isValid ? (
              <div className="p-4 rounded-xl bg-emerald-950/20 border border-emerald-900/50 space-y-2 font-mono text-xs text-slate-300">
                <div className="text-emerald-400 font-bold mb-1">
                  ✓ Record passed master regex verification!
                </div>
                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  <div>
                    <span className="text-slate-400">Timestamp: </span>
                    <span className="text-indigo-300">{validationResult.data?.timestampString}</span>
                  </div>
                  <div>
                    <span className="text-slate-400">Host ID: </span>
                    <span className="text-indigo-300">{validationResult.data?.hostId}</span>
                  </div>
                  <div>
                    <span className="text-slate-400">Bandwidth: </span>
                    <span className="text-indigo-300">{validationResult.data?.bandwidth} Mbps</span>
                  </div>
                  <div>
                    <span className="text-slate-400">Direction: </span>
                    <span className="text-indigo-300">{validationResult.data?.direction}</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-4 rounded-xl bg-rose-950/20 border border-rose-900/50 space-y-2">
                <div className="text-rose-400 font-bold font-mono text-xs flex items-center space-x-1">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>Validation Errors Detected:</span>
                </div>
                <ul className="list-disc list-inside space-y-1 text-xs text-rose-200/90 font-mono">
                  {validationResult?.errors?.map((err, i) => (
                    <li key={i}>{err}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Ingestion Pipeline Feedback */}
            {submitFeedback && (
              <div
                className={`mt-3 p-3 rounded-xl border text-xs font-mono ${
                  submitFeedback.success
                    ? 'bg-indigo-950/40 border-indigo-800 text-indigo-300'
                    : 'bg-rose-950/40 border-rose-800 text-rose-300'
                }`}
              >
                <div className="font-bold">{submitFeedback.message}</div>
                {submitFeedback.details?.length > 0 && (
                  <ul className="mt-1 list-disc list-inside text-[11px] opacity-80">
                    {submitFeedback.details.map((d, i) => (
                      <li key={i}>{d}</li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
        </div>

      </div>

      {/* Forensic Audit Log of Rejected Invalid Records */}
      <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-5 backdrop-blur-sm shadow-xl">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 text-rose-400" />
            <h3 className="text-xs font-bold uppercase tracking-wider font-mono text-slate-200">
              Forensic Log of Rejected Malformed Records ({invalidLogs.length})
            </h3>
          </div>
          <button
            onClick={loadInvalidLogs}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200"
            title="Refresh Rejection Log"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoadingLogs ? 'animate-spin' : ''}`} />
          </button>
        </div>

        <div className="overflow-x-auto border border-slate-800/80 rounded-xl">
          <table className="w-full text-left text-xs font-mono text-slate-300">
            <thead className="bg-slate-950 text-slate-400 uppercase border-b border-slate-800">
              <tr>
                <th className="py-2 px-3">Received Time</th>
                <th className="py-2 px-3">Raw Payload</th>
                <th className="py-2 px-3">Rejection Diagnostic Reason</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {invalidLogs.length === 0 ? (
                <tr>
                  <td colSpan={3} className="py-6 text-center text-slate-500">
                    No malformed records logged yet.
                  </td>
                </tr>
              ) : (
                invalidLogs.map((log) => (
                  <tr key={log._id} className="hover:bg-slate-800/20">
                    <td className="py-2 px-3 text-slate-400 text-[11px]">
                      {new Date(log.receivedAt).toLocaleTimeString()}
                    </td>
                    <td className="py-2 px-3 text-rose-300 font-semibold break-all">
                      {log.rawRecord}
                    </td>
                    <td className="py-2 px-3 text-slate-400 text-[11px]">
                      {log.failureReason}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}
