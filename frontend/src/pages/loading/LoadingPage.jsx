import logo from "../../assets/infinite.svg";

function Waiting() {
  return (
    <div
      className="min-h-screen bg-cover bg-center bg-no-repeat flex flex-col"
      style={{ backgroundImage: "url('/src/assets/bg.jpg')" }}
    >
      <header>
        <div className="flex items-center justify-center text-white px-6 py-7">
          <div className="shrink-0">
            <p className="text-3xl">Proslides</p>
          </div>
        </div>
      </header>

      {/* This div will take all remaining space and center the logo */}
      <div className="flex flex-row items-center justify-center mt-[30vh]">
        <img src={logo} alt="Logo" className="w-40 h-40" />
      </div>
    </div>
  );
}

export default Waiting;
