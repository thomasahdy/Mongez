const AuthRightPanel = () => {
  return (
    <div className="w-[480px] bg-gradient-to-br from-[#1a1a2e] to-[#2d2d4e] hidden lg:flex flex-col items-center justify-center px-12 py-16 text-white relative overflow-hidden">
      <div className="absolute top-[-100px] right-[-100px] w-[300px] h-[300px] bg-[radial-gradient(circle,rgba(0,168,232,0.15)_0%,transparent_70%)] pointer-events-none"></div>
      <div className="absolute bottom-[-80px] left-[-80px] w-[250px] h-[250px] bg-[radial-gradient(circle,rgba(99,102,241,0.12)_0%,transparent_70%)] pointer-events-none"></div>

      <div className="relative z-10 text-center">
        <h2 className="text-[28px] font-extrabold mb-3 tracking-[-0.5px] leading-tight">
          Manage projects<br />
          with confidence
        </h2>

        <p className="text-[15px] opacity-85 leading-[1.7] max-w-xs mx-auto mb-8">
          Join thousands of teams using Mongez to deliver on time, on budget,
          with AI-powered insights.
        </p>

        <div className="flex gap-8 justify-center mb-8">
          <div>
            <div className="text-[28px] font-extrabold leading-none">2.4k+</div>
            <div className="text-xs opacity-75 mt-0.5">Active Teams</div>
          </div>
          <div>
            <div className="text-[28px] font-extrabold leading-none">89%</div>
            <div className="text-xs opacity-75 mt-0.5">On-Time Rate</div>
          </div>
          <div>
            <div className="text-[28px] font-extrabold leading-none">4.8★</div>
            <div className="text-xs opacity-75 mt-0.5">User Rating</div>
          </div>
        </div>

        <div className="mt-12 p-6 bg-[rgba(255,255,255,0.08)] border border-white/10 rounded-lg text-left">
          <p className="text-sm leading-[1.7] opacity-90 mb-4">
            "Mongez helped us cut project delays by 40%. The AI nudges are
            incredibly useful for keeping things moving."
          </p>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-xs font-bold flex-shrink-0">
              AH
            </div>
            <div>
              <div className="text-xs font-semibold">Ahmed Hassan</div>
              <div className="text-xs opacity-60">Director, Al-Noor Foundation</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AuthRightPanel;
