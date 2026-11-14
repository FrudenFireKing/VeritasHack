import React, { useState } from 'react'
import Header from './components/Header.jsx'
import Hero from './components/Hero.jsx'
import Quotes from './components/Quotes.jsx'
import Lab from './components/Lab.jsx'
import Process from './components/Process.jsx'
import Archive from './components/Archive.jsx'
import Footer from './components/Footer.jsx'
import { loadArchive } from './lib/demoEngine.js'

export default function App() {
  const [archive, setArchive] = useState(() => loadArchive())

  return (
    <div className="min-h-screen flex flex-col ornament" id="top">
      <Header />
      <main className="flex-1">
        <Hero />
        <Quotes />
        <Lab onArchived={setArchive} />
        <Process />
        <Archive items={archive} />
      </main>
      <Footer />
    </div>
  )
}
