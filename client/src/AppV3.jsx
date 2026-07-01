import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Navbar from './components/Navbar'
import Footer from './components/Footer'
import V3VisibilityFlow from './pages/v3/VisibilityFlow'
import Dashboard from './pages/v3/Dashboard'
import HomeV2 from './pages/v2/Home'
import PricingV2 from './pages/v2/Pricing'
import Features from './pages/Features'
import { BlogList, BlogPost } from './pages/Blog'
import UseCases from './pages/UseCases'
import CaseStudies from './pages/CaseStudies'

function Layout({ children, noFooter }) {
  return (
    <div className="flex flex-col min-h-screen">
      <Navbar version="v2" />
      <main className="flex-1">{children}</main>
      {!noFooter && <Footer />}
    </div>
  )
}

export default function AppV3() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout><HomeV2 /></Layout>} />
        <Route path="/v2" element={<Layout><HomeV2 /></Layout>} />
        <Route path="/app" element={<Layout noFooter><V3VisibilityFlow /></Layout>} />
        <Route path="/v2/app" element={<Layout noFooter><V3VisibilityFlow /></Layout>} />
        <Route path="/v3/app" element={<Layout noFooter><V3VisibilityFlow /></Layout>} />
        <Route path="/dashboard" element={<Layout noFooter><Dashboard /></Layout>} />
        <Route path="/pricing" element={<Layout><PricingV2 /></Layout>} />
        <Route path="/features" element={<Layout><Features /></Layout>} />
        <Route path="/blog" element={<Layout><BlogList /></Layout>} />
        <Route path="/blog/:slug" element={<Layout><BlogPost /></Layout>} />
        <Route path="/use-cases" element={<Layout><UseCases /></Layout>} />
        <Route path="/case-studies" element={<Layout><CaseStudies /></Layout>} />
        <Route path="*" element={
          <Layout>
            <div className="max-w-xl mx-auto px-6 py-24 text-center">
              <h1 className="text-2xl font-bold text-gray-900 mb-4">Page not found</h1>
              <a href="/" className="text-indigo-600 hover:underline text-sm">Go home →</a>
            </div>
          </Layout>
        } />
      </Routes>
    </BrowserRouter>
  )
}
