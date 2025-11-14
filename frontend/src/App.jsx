import { BrowserRouter, Routes, Route } from "react-router-dom";
import HomePage from "./pages/quiz/manager/HomePage";
import EditorPage from "./pages/quiz/manager/EditorPage";
import "./App.css";

export default function App() {
  return (
    <>
    
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/editor" element={<EditorPage />} />
        </Routes>
      </BrowserRouter>
      
    </>
  );
}
