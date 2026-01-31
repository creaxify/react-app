import { useState } from 'react'

function App() {
  return (
    <div className="app">
      {/* Hero Section */}
      <section className="hero">
        <div className="container hero-content">
          <h1>Build the Future with Us</h1>
          <p style={{ margin: "1.5rem 0 2.5rem 0" }}>
            Experience the next generation of web design. Fast, responsive, and incredibly beautiful.
          </p>
          <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
            <a href="#features" className="btn btn-primary">Get Started</a>
            <a href="#github" className="glass btn" style={{ color: 'white' }}>View on GitHub</a>
          </div>
        </div>
        
        {/* Floating Abstract Element */}
        <div className="glass" style={{
          position: 'absolute',
          width: '100px',
          height: '100px',
          borderRadius: '20px',
          top: '20%',
          right: '15%',
          animation: 'float 6s ease-in-out infinite',
          zIndex: -1
        }}></div>
        <div className="glass" style={{
          position: 'absolute',
          width: '150px',
          height: '150px',
          borderRadius: '50%',
          bottom: '15%',
          left: '10%',
          animation: 'float 8s ease-in-out infinite reverse',
          zIndex: -1
        }}></div>
      </section>

      {/* Features Section */}
      <section id="features" className="container">
        <h2 style={{ textAlign: 'center' }}>Why Choose Us</h2>
        <div className="features-grid">
          {[
            { title: "Blazing Fast", desc: "Built with Vite for instant server start and lightning fast HMR." },
            { title: "Modern Design", desc: "Glassmorphism aesthetics that stand out from the crowd." },
            { title: "React Powered", desc: "Leveraging the full power of the React ecosystem." }
          ].map((feature, i) => (
            <div key={i} className="glass feature-card">
              <h3 style={{ color: 'var(--primary)', marginBottom: '0.5rem' }}>{feature.title}</h3>
              <p>{feature.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="footer">
        <p>© 2026 Premium React App. All rights reserved.</p>
      </footer>
    </div>
  )
}

export default App
