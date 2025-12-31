// import { useState, useEffect } from "react";
// import QRCode from "qrcode";
// import { X } from "lucide-react";

// export default function ShareMenu({ isOpen, onClose, accessCode }) {
//   const [section, setSection] = useState("invite"); // ← پیشفرض: invite audience
//   const [code, setCode] = useState(accessCode || "");
//   const [qr, setQr] = useState("");

//   const BASE = "https://Proslides.com/";

//   // Update code when accessCode prop changes
//   useEffect(() => {
//     if (accessCode) {
//       setCode(accessCode);
//     }
//   }, [accessCode]);

//   // --- Generate QR Code ---
//   useEffect(() => {
//     if (!code || code.length < 5) {
//       setQr(""); // هنوز QR ساخته نشه
//       return;
//     }

//     const full = BASE + code;

//     QRCode.toDataURL(full, { margin: 2 })
//       .then((url) => setQr(url))
//       .catch((err) => console.error(err));
//   }, [code]);

//   if (!isOpen) return null;

//   return (
//     <>
//       {/* Modal */}
//       <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[100]">
//         <div className="bg-white w-[750px] h-[500px] rounded-2xl shadow-xl flex overflow-hidden relative">
//           {/* Close button */}
//           <button
//             onClick={onClose}
//             className="absolute right-5 top-5 text-gray-500 hover:text-black"
//           >
//             <X className="w-6 h-6" />
//           </button>

//           {/* LEFT COLUMN — Menu */}
//           <div className="w-1/3 bg-pink-50 border-r p-5 flex flex-col gap-3">
//             <h2 className="text-lg font-semibold text-pink-700 mb-2">
//               Share options
//             </h2>

//             <MenuItem
//               label="Invite audience"
//               active={section === "invite"}
//               onClick={() => setSection("invite")}
//             />

//             <MenuItem
//               label="Add collaborators"
//               active={section === "collab"}
//               onClick={() => setSection("collab")}
//             />

//             <MenuItem
//               label="Share slides"
//               active={section === "slides"}
//               onClick={() => setSection("slides")}
//             />

//             <MenuItem
//               label="Publish"
//               active={section === "publish"}
//               onClick={() => setSection("publish")}
//             />

//             <div className="border-t pt-3 mt-3">
//               <MenuItem
//                 label="Integrations"
//                 active={section === "integration"}
//                 onClick={() => setSection("integration")}
//               />
//             </div>
//           </div>

//           {/* RIGHT COLUMN — Dynamic Content */}
//           <div className="w-2/3 p-6 overflow-y-auto">
//             {section === "invite" && (
//               <InviteAudienceUI
//                 BASE={BASE}
//                 code={code}
//                 setCode={setCode}
//                 qr={qr}
//               />
//             )}

//             {section === "collab" && <Placeholder title="Add collaborators" />}

//             {section === "slides" && <Placeholder title="Share slides" />}

//             {section === "publish" && (
//               <Placeholder title="Publish your presentation" />
//             )}

//             {section === "integration" && <Placeholder title="Integrations" />}
//           </div>
//         </div>
//       </div>
//     </>
//   );
// }

// /* --- COMPONENTS --- */

// function MenuItem({ label, active, onClick }) {
//   return (
//     <button
//       className={`w-full text-left px-3 py-2 rounded-lg font-medium transition
//         ${
//           active
//             ? "bg-pink-200 text-pink-700"
//             : "hover:bg-pink-100 text-gray-700"
//         }`}
//       onClick={onClick}
//     >
//       {label}
//     </button>
//   );
// }

// /* Invite audience UI */
// function InviteAudienceUI({ BASE, code, setCode, qr }) {
//   return (
//     <div>
//       <h2 className="text-xl font-semibold text-gray-800 mb-3">
//         Invite audience
//       </h2>

//       <p className="text-gray-600 text-sm">Audience can join at</p>

//       <div className="mt-2 flex items-center gap-2">
//         <span className="text-gray-500">{BASE}</span>
//         <input
//           className="border rounded-lg px-2 py-1 w-40 focus:ring-2 focus:ring-pink-400"
//           placeholder="room1"
//           value={code}
//           onChange={(e) => setCode(e.target.value.trim())}
//         />
//       </div>
//       {code.length > 0 && code.length < 5 && (
//         <p className="text-red-500 text-sm mt-3">
//           کد باید حداقل ۵ کاراکتر باشد.
//         </p>
//       )}
//       {qr && (
//         <div className="mt-6 flex flex-col items-center">
//           <p className="text-sm text-gray-600 mb-2">or scan QR</p>
//           <img
//             src={qr}
//             alt="qr"
//             className="w-44 h-44 border rounded-xl shadow"
//           />

//           <a
//             download="qr.png"
//             href={qr}
//             className="mt-3 px-4 py-1.5 bg-pink-600 hover:bg-pink-700 text-white rounded-lg text-sm shadow transition"
//           >
//             Download QR
//           </a>
//         </div>
//       )}
//     </div>
//   );
// }

// // Placeholder components for unfinished sections
// function Placeholder({ title }) {
//   return (
//     <div className="text-center text-gray-400 pt-20">
//       <p className="text-xl font-semibold">{title}</p>
//       <p className="text-sm mt-2">This section is not implemented yet.</p>
//     </div>
//   );
// }


























import { useState, useEffect } from "react";
import QRCode from "qrcode";
import { X, Check, Loader2 } from "lucide-react";
import { apiFetch } from "../utils/apiFetch";

export default function ShareMenu({ quizId, isOpen, onClose, accessCode }) {
  const [section, setSection] = useState("invite");
  const [code, setCode] = useState(accessCode || "");
  const [qr, setQr] = useState("");
  const [inputError, setInputError] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [saveSuccess, setSaveSuccess] = useState(false);

  const BASE = "https://Proslides.com/";

  // اعتبارسنجی کد
  const validateCode = (input) => {
    if (input.length > 12) {
      return "The code must be a maximum of 12 characters.";
    }
    if (!/^[A-Za-z0-9]*$/.test(input)) {
      return "Only English letters and numbers are allowed.";
    }
    return "";
  };

  // تابع ارسال کد به بک‌اند
  const saveAccessCode = async () => {
    if (!code || inputError || code.length < 5) return;
    
    setIsSaving(true);
    setSaveError("");
    setSaveSuccess(false);
    
    try {
      const response = await apiFetch(`/quizzes/${quizId}/`, {
        method: "PATCH",
        json: {
          access_code: code,
        },
      });
      
      if (!response.ok) {
        throw new Error(`Failed to save: ${response.statusText}`);
      }
      
      const data = await response.json();
      setSaveSuccess(true);
      
      // پیام موفقیت بعد از 3 ثانیه پاک می‌شود
      setTimeout(() => {
        setSaveSuccess(false);
      }, 3000);
      
    } catch (error) {
      console.error('Error saving access code:', error);
      setSaveError(error.message || 'Failed to save access code');
    } finally {
      setIsSaving(false);
    }
  };

  // Update code when accessCode prop changes
  useEffect(() => {
    if (accessCode) {
      setCode(accessCode);
      setInputError(validateCode(accessCode));
    }
  }, [accessCode]);

  // --- Generate QR Code ---
  useEffect(() => {
    if (!code || inputError || code.length < 5) {
      setQr("");
      return;
    }

    const full = BASE + code;
    QRCode.toDataURL(full, { margin: 2 })
      .then((url) => setQr(url))
      .catch((err) => console.error(err));
  }, [code, inputError]);

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[100]">
        <div className="bg-white w-[750px] h-[500px] rounded-2xl shadow-xl flex overflow-hidden relative">
          <button
            onClick={onClose}
            className="absolute right-5 top-5 text-gray-500 hover:text-black"
          >
            <X className="w-6 h-6" />
          </button>

          <div className="w-1/3 bg-pink-50 border-r p-5 flex flex-col gap-3">
            <h2 className="text-lg font-semibold text-pink-700 mb-2">
              Share options
            </h2>
            <MenuItem
              label="Invite audience"
              active={section === "invite"}
              onClick={() => setSection("invite")}
            />
            <MenuItem
              label="Add collaborators"
              active={section === "collab"}
              onClick={() => setSection("collab")}
            />
            <MenuItem
              label="Share slides"
              active={section === "slides"}
              onClick={() => setSection("slides")}
            />
            <MenuItem
              label="Publish"
              active={section === "publish"}
              onClick={() => setSection("publish")}
            />
            <div className="border-t pt-3 mt-3">
              <MenuItem
                label="Integrations"
                active={section === "integration"}
                onClick={() => setSection("integration")}
              />
            </div>
          </div>

          <div className="w-2/3 p-6 overflow-y-auto">
            {section === "invite" && (
              <InviteAudienceUI
                BASE={BASE}
                code={code}
                setCode={setCode}
                setInputError={setInputError}
                validateCode={validateCode}
                qr={qr}
                inputError={inputError}
                onSave={saveAccessCode}
                isSaving={isSaving}
                saveError={saveError}
                saveSuccess={saveSuccess}
              />
            )}
            {section === "collab" && <Placeholder title="Add collaborators" />}
            {section === "slides" && <Placeholder title="Share slides" />}
            {section === "publish" && (
              <Placeholder title="Publish your presentation" />
            )}
            {section === "integration" && <Placeholder title="Integrations" />}
          </div>
        </div>
      </div>
    </>
  );
}

function MenuItem({ label, active, onClick }) {
  return (
    <button
      className={`w-full text-left px-3 py-2 rounded-lg font-medium transition
        ${
          active
            ? "bg-pink-200 text-pink-700"
            : "hover:bg-pink-100 text-gray-700"
        }`}
      onClick={onClick}
    >
      {label}
    </button>
  );
}

function InviteAudienceUI({ 
  BASE, 
  code, 
  setCode, 
  setInputError, 
  validateCode, 
  qr, 
  inputError,
  onSave,
  isSaving,
  saveError,
  saveSuccess
}) {
  
  const handleCodeChange = (e) => {
    const newCode = e.target.value.trim();
    setCode(newCode);
    setInputError(validateCode(newCode));
  };

  // بررسی معتبر بودن کد برای فعال/غیرفعال کردن دکمه
  const isCodeValid = code.length >= 5 && !inputError;

  return (
    <div>
      <h2 className="text-xl font-semibold text-gray-800 mb-3">
        Invite audience
      </h2>

      <p className="text-gray-600 text-sm">Audience can join at</p>

      <div className="mt-2 flex items-center gap-2">
        <span className="text-gray-500">{BASE}</span>
        <div className="relative">
          <input
            className={`border rounded-lg px-2 py-1 w-40 focus:ring-2 focus:ring-pink-400 ${
              inputError ? "border-red-500" : "border-gray-300"
            }`}
            placeholder="room1"
            value={code}
            onChange={handleCodeChange}
            maxLength={12}
          />
          
          {/* آیکون تیک */}
          <button
            onClick={onSave}
            disabled={!isCodeValid || isSaving}
            className={`absolute right-2 top-1/2 transform -translate-y-1/2 p-1 rounded-md transition
              ${!isCodeValid ? 'text-gray-300 cursor-not-allowed' : 'text-green-600 hover:bg-green-50 hover:text-green-700'}
              ${isSaving ? 'cursor-wait' : ''}`}
            title={!isCodeValid ? "Enter a valid code (5-12 characters, letters and numbers only)" : "Save access code"}
          >
            {isSaving ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Check className="w-4 h-4" />
            )}
          </button>
        </div>
      </div>

      {/* نمایش پیام خطای اعتبارسنجی */}
      {inputError && (
        <p className="text-red-500 text-sm mt-3">{inputError}</p>
      )}

      {/* نمایش پیام خطا برای طول کم */}
      {code.length > 0 && code.length < 5 && !inputError && (
        <p className="text-red-500 text-sm mt-3">
          The code must be at least 5 and at most 12 characters long.
        </p>
      )}

      {/* پیام موفقیت یا خطای ذخیره‌سازی */}
      {saveSuccess && (
        <p className="text-green-600 text-sm mt-3">✓ Access code saved successfully!</p>
      )}
      
      {saveError && (
        <p className="text-red-500 text-sm mt-3">Error: {saveError}</p>
      )}

      {/* نمایش QR فقط اگر کد معتبر باشد و خطایی وجود نداشته باشد */}
      {qr && !inputError && code.length >= 5 && (
        <div className="mt-6 flex flex-col items-center">
          <p className="text-sm text-gray-600 mb-2">scan QR or</p>
          <img
            src={qr}
            alt="qr"
            className="w-44 h-44 border rounded-xl shadow"
          />

          <a
            download="qr.png"
            href={qr}
            className="mt-3 px-4 py-1.5 bg-pink-600 hover:bg-pink-700 text-white rounded-lg text-sm shadow transition"
          >
            Download QR
          </a>
        </div>
      )}
    </div>
  );
}

function Placeholder({ title }) {
  return (
    <div className="text-center text-gray-400 pt-20">
      <p className="text-xl font-semibold">{title}</p>
      <p className="text-sm mt-2">This section is not implemented yet.</p>
    </div>
  );
}
