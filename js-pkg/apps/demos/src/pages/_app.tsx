import type { AppProps } from 'next/app'
import Link from 'next/link'
import { Fragment, useState } from 'react'
import { Dialog, Transition } from '@headlessui/react'
import { Bars3Icon, XMarkIcon } from '@heroicons/react/24/outline'
import Logo from '../components/Logo'
import '../styles/style.css'

function classNames(...classes: string[]) {
  return classes.filter(Boolean).join(' ')
}

function NavLink({
  href,
  curRoute,
  children
}: {
  href: string
  curRoute: string
  children: JSX.Element | string
}) {
  const classes = classNames(
    href === curRoute
      ? 'bg-gray-900 text-white'
      : 'text-gray-300 hover:bg-gray-700 hover:text-white',
    'group flex items-center rounded-md px-2 py-2 text-base font-medium cursor-pointer'
  )
  return (
    <Link href={href}>
      <li className={classes}>{children}</li>
    </Link>
  )
}

function Nav({ isDesktop, curRoute }: { isDesktop?: boolean; curRoute: string }) {
  return (
    <div
      className={classNames(
        isDesktop ? 'flex flex-col' : 'h-0',
        'flex-1 overflow-y-auto pt-5 pb-4'
      )}
    >
      <a href="/" className="flex flex-shrink-0 items-center px-4 gap-4">
        <Logo className="h-8 w-8" />
        <h1 className="text-gray-200 text-lg font-extrabold">DriftDB Demos</h1>
      </a>
      <nav className={classNames(isDesktop ? 'text-base' : 'flex-1 text-sm', 'mt-5 px-2')}>
        <h3 className="text-gray-500 text-xs uppercase">Basic</h3>
        <ul>
          <NavLink href="/state" curRoute={curRoute}>
            Shared State
          </NavLink>
          <NavLink href="/counter" curRoute={curRoute}>
            Counter
          </NavLink>
          <NavLink href="/tictactoe" curRoute={curRoute}>
            Tic Tac Toe
          </NavLink>
        </ul>
        <h3 className="text-gray-500 text-xs uppercase mt-6">Advanced</h3>
        <ul>
          <NavLink href="/shared-canvas" curRoute={curRoute}>
            Shared Canvas
          </NavLink>
          <NavLink href="/voxel" curRoute={curRoute}>
            Voxel Editor
          </NavLink>
          <NavLink href="/webrtc" curRoute={curRoute}>
            WebRTC Chat
          </NavLink>
        </ul>
      </nav>
    </div>
  )
}

function SidebarLayout({ curRoute, children }: { curRoute: string; children: JSX.Element }) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  return (
    <>
      <div className="h-full w-full absolute">
        <Transition.Root show={sidebarOpen} as={Fragment}>
          <Dialog as="div" className="relative z-40 lg:hidden" onClose={setSidebarOpen}>
            <Transition.Child
              as={Fragment}
              enter="transition-opacity ease-linear duration-300"
              enterFrom="opacity-0"
              enterTo="opacity-100"
              leave="transition-opacity ease-linear duration-300"
              leaveFrom="opacity-100"
              leaveTo="opacity-0"
            >
              <div className="fixed inset-0 bg-gray-600 bg-opacity-75" />
            </Transition.Child>

            <div className="fixed inset-0 z-40 flex">
              <Transition.Child
                as={Fragment}
                enter="transition ease-in-out duration-300 transform"
                enterFrom="-translate-x-full"
                enterTo="translate-x-0"
                leave="transition ease-in-out duration-300 transform"
                leaveFrom="translate-x-0"
                leaveTo="-translate-x-full"
              >
                <Dialog.Panel className="relative flex w-full max-w-xs flex-1 flex-col bg-gray-800">
                  <Transition.Child
                    as={Fragment}
                    enter="ease-in-out duration-300"
                    enterFrom="opacity-0"
                    enterTo="opacity-100"
                    leave="ease-in-out duration-300"
                    leaveFrom="opacity-100"
                    leaveTo="opacity-0"
                  >
                    <div className="absolute top-0 right-0 -mr-12 pt-2">
                      <button
                        type="button"
                        className="ml-1 flex h-10 w-10 items-center justify-center rounded-full focus:outline-none focus:ring-2 focus:ring-inset focus:ring-white"
                        onClick={() => setSidebarOpen(false)}
                      >
                        <span className="sr-only">Close sidebar</span>
                        <XMarkIcon className="h-6 w-6 text-white" aria-hidden="true" />
                      </button>
                    </div>
                  </Transition.Child>
                  <Nav curRoute={curRoute} />
                </Dialog.Panel>
              </Transition.Child>
              <div className="w-14 flex-shrink-0">
                {/* Force sidebar to shrink to fit close icon */}
              </div>
            </div>
          </Dialog>
        </Transition.Root>

        {/* Static sidebar for desktop */}
        <div className="hidden lg:fixed lg:inset-y-0 lg:flex lg:w-64 lg:flex-col relative z-10">
          <div className="flex min-h-0 flex-1 flex-col bg-gray-800">
            <Nav isDesktop curRoute={curRoute} />
          </div>
        </div>
        <div className="flex flex-1 flex-col lg:pl-64 h-full">
          <div className="sticky top-0 z-10 bg-gray-100 pl-1 pt-1 sm:pl-3 sm:pt-3 lg:hidden">
            <button
              type="button"
              className="-ml-0.5 -mt-0.5 inline-flex h-12 w-12 items-center justify-center rounded-md text-gray-500 hover:text-gray-900 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-indigo-500"
              onClick={() => setSidebarOpen(true)}
            >
              <span className="sr-only">Open sidebar</span>
              <Bars3Icon className="h-6 w-6" aria-hidden="true" />
            </button>
          </div>
          <main className="flex-1 p-8 relative z-0 h-full">{children}</main>
        </div>
      </div>
    </>
  )
}

export default function App({ Component, pageProps, router }: AppProps) {
  if (router.route === '/') return <Component {...pageProps} />

  return (
    <SidebarLayout curRoute={router.route}>
      <Component {...pageProps} />
    </SidebarLayout>
  )
}
