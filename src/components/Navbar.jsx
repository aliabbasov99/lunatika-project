import React, { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'

const Navbar = () => {
    const [menuOpen, setMenuOpen] = useState(false)
    const location = useLocation()

    // Navbardakı sözlər və göndərdiyi səhifələr (tam saxlanılıb)
    const navItems = [
        { label: 'Home', href: '/' },
        { label: 'AI Chatbot', href: '/chat' },
        { label: 'Simulation', href: '/simulation' },
        { label: 'AI Asistent', href: '#' },
        { label: 'About Us', href: '#' },
    ]

    const isCurrentActive = (href) => {
        if (href === '#') return false
        return location.pathname === href
    }

    return (
        <header className="fixed top-0 left-0 w-full z-50 flex justify-center pt-3 sm:pt-4 px-4 pointer-events-none select-none">
            {/* Minimalist Ultra-Clean Glass Bar */}
            <div className="pointer-events-auto w-full max-w-4xl px-5 sm:px-7 py-2 min-h-[44px] rounded-full bg-white/[0.02] backdrop-blur-md border border-white/[0.06] shadow-[0_6px_25px_rgba(0,0,0,0.45)] flex items-center justify-between transition-all duration-300 hover:border-white/[0.12] hover:bg-white/[0.035]">
                
                {/* Minimalist Logo */}
                <Link 
                    to="/" 
                    className="flex items-center gap-2 group transition-opacity hover:opacity-80"
                    style={{ color: '#FFFFFF' }}
                >
                    <span 
                        className="text-white text-[clamp(11px,0.75rem+0.25vw,14px)] font-semibold tracking-[0.25em] uppercase drop-shadow-[0_0_10px_rgba(255,255,255,0.4)]"
                        style={{ color: '#FFFFFF' }}
                    >
                        Lunatika
                    </span>
                </Link>

                {/* Minimalist Soft Grey Links - Xəfif boz rəng (#b5b8bd) */}
                <nav className="hidden md:flex items-center gap-6 lg:gap-8 text-[clamp(11.5px,0.7rem+0.2vw,13.5px)] font-normal tracking-wide">
                    {navItems.map((item) => {
                        const active = isCurrentActive(item.href)

                        return (
                            <Link
                                key={item.label}
                                to={item.href}
                                className={`transition-all duration-200 nav-link-item ${
                                    active ? 'active-link font-semibold' : 'font-normal'
                                }`}
                                style={{ 
                                    color: active ? '#FFFFFF' : '#b5b8bd',
                                    textDecoration: 'none' 
                                }}
                            >
                                {item.label}
                            </Link>
                        )
                    })}
                </nav>

                {/* Mobile Menu Button */}
                <button 
                    onClick={() => setMenuOpen(!menuOpen)} 
                    aria-label="Toggle Menu"
                    className="md:hidden flex flex-col justify-center gap-1.5 w-7 h-7 p-1 cursor-pointer bg-transparent border-0 text-white opacity-85 hover:opacity-100"
                >
                    <span className={`block w-4 h-0.5 bg-white transition-transform duration-200 ${menuOpen ? 'rotate-45 translate-y-2' : ''}`}></span>
                    <span className={`block w-4 h-0.5 bg-white transition-opacity duration-200 ${menuOpen ? 'opacity-0' : ''}`}></span>
                    <span className={`block w-4 h-0.5 bg-white transition-transform duration-200 ${menuOpen ? '-rotate-45 -translate-y-2' : ''}`}></span>
                </button>
            </div>

            {/* Mobile Dropdown Menu (Minimalist Glass) */}
            {menuOpen && (
                <div className="pointer-events-auto absolute top-full mt-2 w-[92%] max-w-sm rounded-2xl bg-black/85 backdrop-blur-3xl border border-white/10 flex flex-col p-3.5 gap-1.5 md:hidden shadow-2xl">
                    {navItems.map((item) => {
                        const active = isCurrentActive(item.href)
                        return (
                            <Link 
                                key={item.label} 
                                to={item.href} 
                                onClick={() => setMenuOpen(false)}
                                className="px-4 py-2 rounded-xl text-xs font-normal transition-all nav-link-item"
                                style={{ 
                                    color: active ? '#FFFFFF' : '#b5b8bd',
                                    backgroundColor: active ? 'rgba(255, 255, 255, 0.08)' : 'transparent',
                                    textDecoration: 'none' 
                                }}
                            >
                                {item.label}
                            </Link>
                        )
                    })}
                </div>
            )}
        </header>
    )
}

export default Navbar
