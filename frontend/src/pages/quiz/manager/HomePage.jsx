// import { Button } from "../../../components/ui/button";
// import { useNavigate } from "react-router-dom";

// export default function HomePage() {
//   const navigate = useNavigate();
//   return (
//     <div className="h-screen flex items-center justify-center bg-gray-50">
//       <Button
//         className="text-lg px-6 py-3"
//         onClick={() => navigate("/editor")}
//       >
//         New Presentation
//       </Button>
//     </div>
//   );
// }


//////////////////////////////////////////////////////////////////////////////////////////////


// import { useNavigate } from "react-router-dom";
// import QuizManager from "../../../components/QuizManager";

// export default function HomePage() {
//   const navigate = useNavigate();

//   return <QuizManager onNewPresentation={() => navigate("/editor")} />;
// }




///////////////////////////////////////////////////////////////////////////////////////////////





// import { useNavigate } from "react-router-dom";
// import QuizManager from "../../../components/QuizManager";
// import { quizService } from "../../../services/quizService";
// import { useState } from "react";

// export default function HomePage() {
//   const navigate = useNavigate();
//   const [isCreating, setIsCreating] = useState(false);

//   const handleNewPresentation = async () => {
//     if (isCreating) return; // جلوگیری از کلیک‌های متعدد
    
//     setIsCreating(true);
//     try {
//       const newQuiz = await quizService.createEmptyQuiz();
//       // navigate(`/editor?quiz_id=${newQuiz.quiz_id}`);
//       navigate(`/editor`);

//     } catch (error) {
//       console.error('Failed to create new presentation:', error);
//       navigate("/editor");
//     } finally {
//       setIsCreating(false);
//     }
//   };

//   return (
//     <QuizManager 
//       onNewPresentation={handleNewPresentation} 
//       isCreating={isCreating}
//     />
//   );
// }








import { Button } from "../../../components/ui/button";
import { useNavigate } from "react-router-dom";
import QuizManager from "../../../components/QuizManager";

export default function HomePage() {
  const navigate = useNavigate();

  return (
    <QuizManager
      onNewPresentation={(roomId) => navigate(`/manager/panel/${roomId}`)}
    />
  );
}