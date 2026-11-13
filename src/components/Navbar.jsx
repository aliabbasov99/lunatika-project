import React from 'react'

const Navbar = () => {
    const [menuOpen, setMenuOpen] = React.useState(false)
    const navItems = ['Home', 'Findings', 'Simulator', 'AI Asistent', 'About Us'];

    return (
        <>
            <style>
                {`
                    @import url('https://fonts.googleapis.com/css2?family=Geist:wght@100..900&display=swap');
                    *{
                        font-family: "Geist", sans-serif;
                    }
                `}
            </style>
            <nav className="bg-zinc-950 text-zinc-100 px-6 md:px-12 lg:px-24 xl:px-40 py-4 flex items-center justify-between relative border-b border-zinc-800/80">
                {/* Logo & Brand Name */}
                <a href="#" className="flex items-center gap-3 group">
                    <span className="font-bold md:text-2xl text-2xl tracking-wide text-white transition-colors">
                        Lunatika
                    </span>
                </a>

                {/* Desktop Menu Container */}
                <div className="hidden md:flex items-center bg-zinc-900 border border-zinc-800 rounded-full px-1 py-1 gap-2">
                    {navItems.map((item) => (
                        <a key={item} href="#" className={`px-4 py-1.5 rounded-full text-sm transition-colors ${item === 'Home' ? 'bg-zinc-800 border border-zinc-700 font-medium text-zinc-100 hover:text-zinc-300' : 'text-zinc-400 hover:text-zinc-200' }`} >
                            {item}
                        </a>
                    ))}
                </div>

                {/* Get Started Button */}
                {/* <button className="hidden md:flex items-center gap-2.5 bg-gradient-to-r from-zinc-100 to-zinc-400 text-zinc-950 hover:text-zinc-800 text-sm font-medium pl-5 pr-2 py-2 rounded-full cursor-pointer border-0 transition-all shadow-md shadow-zinc-900/50">
                    Get started
                    <span className="size-7 rounded-full bg-zinc-950 flex items-center justify-center">
                        <svg width="12" height="10" viewBox="0 0 12 10" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M.6 4.602h10m-4-4 4 4-4 4" stroke="#ffffff" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                    </span>
                </button> */}

                {/* Mobile Menu Button */}
                <button onClick={() => setMenuOpen(!menuOpen)} className="md:hidden flex flex-col gap-1.5 cursor-pointer bg-transparent border-0 p-1">
                    <span className={`block w-6 h-0.5 bg-zinc-100 transition-transform ${menuOpen ? 'rotate-45 translate-y-2' : ''}`}></span>
                    <span className={`block w-6 h-0.5 bg-zinc-100 transition-opacity ${menuOpen ? 'opacity-0' : ''}`}></span>
                    <span className={`block w-6 h-0.5 bg-zinc-100 transition-transform ${menuOpen ? '-rotate-45 -translate-y-2' : ''}`}></span>
                </button>

                {/* Mobile Dropdown */}
                {menuOpen && (
                    <div className="absolute top-full left-0 w-full bg-zinc-950 border-t border-zinc-800 flex flex-col p-5 gap-1 md:hidden z-50 shadow-2xl">
                        {navItems.map((item) => (
                            <a key={item} href="#" className={`px-4 py-2.5 rounded-lg text-sm ${item === 'Home' ? 'bg-zinc-900 font-medium text-zinc-100' : 'text-zinc-400 hover:bg-zinc-900/60 hover:text-zinc-200' }`} >
                                {item}
                            </a>
                        ))}
                    </div>
                )}
            </nav>
        </>
    )
}

export default Navbar