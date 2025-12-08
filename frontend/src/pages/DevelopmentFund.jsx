import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { fundAPI } from '../services/api'
import { useToast, ConfirmDialog } from '../components/Toast'

const DevelopmentFund = () => {
  const [balance, setBalance] = useState({ balance: 0, balanceEGP: 0, transactionCount: 0 })
  const [transactions, setTransactions] = useState([])
  const [loading, setLoading] = useState(false)
  const [showWithdrawModal, setShowWithdrawModal] = useState(false)
  const [showDepositModal, setShowDepositModal] = useState(false)
  const [withdrawForm, setWithdrawForm] = useState({
    amount: '',
    amountEGP: '',
    currency: 'USD',
    description: '',
    apartment: ''
  })
  const [depositForm, setDepositForm] = useState({
    amount: '',
    amountEGP: '',
    currency: 'USD',
    description: '',
    source: '',
    customSource: '',
    date: new Date().toISOString().split('T')[0],
    apartment: ''
  })
  const [deleteConfirm, setDeleteConfirm] = useState({ open: false, id: null })
  const toast = useToast()

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      setLoading(true)
      const [balanceRes, transactionsRes] = await Promise.all([
        fundAPI.getBalance().catch(() => ({ data: { balance: 0, balanceEGP: 0, transactionCount: 0 } })),
        fundAPI.getTransactions().catch(() => ({ data: [] }))
      ])
      setBalance(balanceRes.data || { balance: 0, balanceEGP: 0, transactionCount: 0 })
      setTransactions(Array.isArray(transactionsRes.data) ? transactionsRes.data : [])
    } catch (error) {
      console.error('Error fetching fund data:', error)
      toast.error('حدث خطأ أثناء تحميل البيانات')
    } finally {
      setLoading(false)
    }
  }

  const handleDeposit = async (e) => {
    e.preventDefault()
    
    if (!depositForm.amount || parseFloat(depositForm.amount) <= 0) {
      toast.warning('يرجى إدخال مبلغ صحيح')
      return
    }

    const finalSource = depositForm.customSource || depositForm.source
    
    if (!finalSource) {
      toast.warning('يرجى تحديد مصدر الإيداع')
      return
    }

    try {
      const description = depositForm.description 
        ? `${finalSource} - ${depositForm.description}`
        : `إيداع خارجي من ${finalSource}`
      
      const response = await fundAPI.deposit({
        amount: parseFloat(depositForm.amount),
        amountEGP: parseFloat(depositForm.amountEGP) || (parseFloat(depositForm.amount) * 50),
        currency: depositForm.currency,
        description: description,
        source: finalSource,
        date: depositForm.date,
        apartment: depositForm.apartment || null
      })

      toast.success('تم الإيداع بنجاح')

      setShowDepositModal(false)
      setDepositForm({
        amount: '',
        amountEGP: '',
        currency: 'USD',
        description: '',
        source: '',
        customSource: '',
        date: new Date().toISOString().split('T')[0],
        apartment: ''
      })
      fetchData()
    } catch (error) {
      console.error('Error depositing:', error)
      toast.error(error.response?.data?.error || 'حدث خطأ أثناء الإيداع')
    }
  }

  const handleWithdraw = async (e) => {
    e.preventDefault()
    
    if (!withdrawForm.amount || parseFloat(withdrawForm.amount) <= 0) {
      toast.warning('يرجى إدخال مبلغ صحيح')
      return
    }

    try {
      const response = await fundAPI.withdraw({
        amount: parseFloat(withdrawForm.amount),
        amountEGP: parseFloat(withdrawForm.amountEGP) || (parseFloat(withdrawForm.amount) * 50),
        currency: withdrawForm.currency,
        description: withdrawForm.description || 'سحب من صندوق التطوير',
        apartment: withdrawForm.apartment || null
      })

      if (response.data?.warning) {
        toast.warning(response.data.warning)
      } else {
        toast.success('تم السحب بنجاح')
      }

      setShowWithdrawModal(false)
      setWithdrawForm({
        amount: '',
        amountEGP: '',
        currency: 'USD',
        description: '',
        apartment: ''
      })
      fetchData()
    } catch (error) {
      console.error('Error withdrawing:', error)
      toast.error(error.response?.data?.error || 'حدث خطأ أثناء السحب')
    }
  }

  const formatDate = (dateString) => {
    if (!dateString) return '-'
    return new Date(dateString).toLocaleDateString('ar-EG', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const getTransactionTypeLabel = (type) => {
    return type === 'deposit' ? 'إيداع' : 'سحب'
  }

  const getTransactionTypeColor = (type) => {
    return type === 'deposit' 
      ? 'bg-green-100 text-green-800 border-green-300' 
      : 'bg-red-100 text-red-800 border-red-300'
  }

  const totalDeposits = transactions
    .filter(t => t.type === 'deposit')
    .reduce((sum, t) => sum + (t.amount || 0), 0)

  const totalWithdrawals = transactions
    .filter(t => t.type === 'withdrawal')
    .reduce((sum, t) => sum + (t.amount || 0), 0)

  const currentDebt = balance.balance < 0 ? Math.abs(balance.balance) : 0

  return (
    <div className="container mx-auto px-2 sm:px-4 py-4 sm:py-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
        <h1 className="text-2xl md:text-3xl font-bold text-[#003580]">💎 صندوق التطوير</h1>
        <div className="flex flex-wrap gap-3 w-full md:w-auto">
          <button
            onClick={() => setShowDepositModal(true)}
            className="flex-1 md:flex-none bg-green-500 text-white px-4 md:px-6 py-3 rounded-lg font-bold hover:bg-green-600 transition-colors flex items-center justify-center gap-2"
          >
            <span>➕</span>
            <span className="text-sm md:text-base">إيداع خارجي</span>
          </button>
          <button
            onClick={() => setShowWithdrawModal(true)}
            className="flex-1 md:flex-none bg-red-500 text-white px-4 md:px-6 py-3 rounded-lg font-bold hover:bg-red-600 transition-colors flex items-center justify-center gap-2"
          >
            <span>💰</span>
            <span className="text-sm md:text-base">سحب سريع</span>
          </button>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-16">
          <div className="text-4xl mb-4">⏳</div>
          <p className="text-gray-600">جاري التحميل...</p>
        </div>
      ) : (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6 mb-8">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl p-6 text-white shadow-lg"
            >
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-lg font-bold">الرصيد الإجمالي</h3>
                <span className="text-3xl">💰</span>
              </div>
              <div className="text-3xl font-black mb-1">
                ${balance.balance.toFixed(2)}
              </div>
              <div className="text-sm opacity-90">
                {balance.balanceEGP.toFixed(2)} ج.م
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="bg-gradient-to-br from-green-500 to-green-600 rounded-xl p-6 text-white shadow-lg"
            >
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-lg font-bold">إجمالي الإيداعات</h3>
                <span className="text-3xl">📈</span>
              </div>
              <div className="text-3xl font-black mb-1">
                ${totalDeposits.toFixed(2)}
              </div>
              <div className="text-sm opacity-90">
                {transactions.filter(t => t.type === 'deposit').length} معاملة
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className={`rounded-xl p-6 text-white shadow-lg ${
                currentDebt > 0
                  ? 'bg-gradient-to-br from-red-500 to-red-600'
                  : 'bg-gradient-to-br from-yellow-500 to-yellow-600'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-lg font-bold">
                  {currentDebt > 0 ? 'الديون الحالية' : 'إجمالي السحوبات'}
                </h3>
                <span className="text-3xl">{currentDebt > 0 ? '⚠️' : '📉'}</span>
              </div>
              <div className="text-3xl font-black mb-1">
                ${currentDebt > 0 ? currentDebt.toFixed(2) : totalWithdrawals.toFixed(2)}
              </div>
              <div className="text-sm opacity-90">
                {currentDebt > 0 
                  ? 'رصيد سالب - مديونية'
                  : `${transactions.filter(t => t.type === 'withdrawal').length} معاملة`
                }
              </div>
            </motion.div>
          </div>

          {/* Transactions Table */}
          <div className="bg-white rounded-xl shadow-lg overflow-hidden">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-xl font-bold text-gray-800">سجل المعاملات</h2>
              <p className="text-sm text-gray-600 mt-1">
                جميع الإيداعات والسحوبات من صندوق التطوير
              </p>
            </div>

            {transactions.length === 0 ? (
              <div className="text-center py-16">
                <div className="text-6xl mb-4">📋</div>
                <h3 className="text-xl font-bold text-gray-800 mb-2">لا توجد معاملات</h3>
                <p className="text-gray-600">لم يتم تسجيل أي معاملات بعد</p>
              </div>
            ) : (
              <div className="overflow-x-auto -mx-6 md:mx-0">
                <table className="w-full min-w-[800px]">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-right text-xs font-bold text-gray-700 uppercase">التاريخ</th>
                      <th className="px-6 py-3 text-right text-xs font-bold text-gray-700 uppercase">النوع</th>
                      <th className="px-6 py-3 text-right text-xs font-bold text-gray-700 uppercase">المبلغ (USD)</th>
                      <th className="px-6 py-3 text-right text-xs font-bold text-gray-700 uppercase">المبلغ (EGP)</th>
                      <th className="px-6 py-3 text-right text-xs font-bold text-gray-700 uppercase">الوصف</th>
                      <th className="px-6 py-3 text-right text-xs font-bold text-gray-700 uppercase">المصدر/السبب</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {transactions.map((transaction, index) => (
                      <motion.tr
                        key={transaction._id}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.05 }}
                        className="hover:bg-gray-50 transition-colors"
                      >
                        <td className="px-3 md:px-6 py-4 whitespace-nowrap text-xs md:text-sm text-gray-600">
                          {formatDate(transaction.transactionDate || transaction.createdAt)}
                        </td>
                        <td className="px-3 md:px-6 py-4 whitespace-nowrap">
                          <span className={`px-2 md:px-3 py-1 rounded-full text-xs font-bold border ${getTransactionTypeColor(transaction.type)}`}>
                            {getTransactionTypeLabel(transaction.type)}
                          </span>
                        </td>
                        <td className={`px-3 md:px-6 py-4 whitespace-nowrap text-xs md:text-sm font-bold ${
                          transaction.type === 'deposit' ? 'text-green-600' : 'text-red-600'
                        }`}>
                          {transaction.type === 'deposit' ? '+' : '-'}${(transaction.amount || 0).toFixed(2)}
                        </td>
                        <td className="px-3 md:px-6 py-4 whitespace-nowrap text-xs md:text-sm text-gray-600">
                          {(transaction.amountEGP || 0).toFixed(2)} ج.م
                        </td>
                        <td className="px-3 md:px-6 py-4 text-xs md:text-sm text-gray-800 max-w-[200px] md:max-w-none truncate md:truncate-none">
                          {transaction.description || '-'}
                        </td>
                        <td className="px-3 md:px-6 py-4 whitespace-nowrap text-xs text-gray-500">
                          {transaction.source ? (
                            <span className="px-2 py-1 bg-purple-100 text-purple-700 rounded text-xs" title={transaction.source}>
                              {transaction.source.length > 15 ? transaction.source.substring(0, 15) + '...' : transaction.source}
                            </span>
                          ) : transaction.isSystemGenerated ? (
                            <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs">تلقائي</span>
                          ) : (
                            <span className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs">يدوي</span>
                          )}
                        </td>
                      </motion.tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {/* Deposit Modal */}
      {showDepositModal && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
          onClick={() => setShowDepositModal(false)}
        >
          <motion.div
            initial={{ scale: 0.9, y: 20 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.9, y: 20 }}
            className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-2xl font-bold text-gray-800">➕ إيداع في صندوق التطوير</h2>
              <button
                onClick={() => setShowDepositModal(false)}
                className="text-gray-500 hover:text-gray-700 text-2xl"
              >
                ×
              </button>
            </div>

                    <form onSubmit={handleDeposit}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-gray-700 font-bold mb-2">المبلغ (USD) *</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    required
                    value={depositForm.amount}
                    onChange={(e) => {
                      const usdAmount = parseFloat(e.target.value) || 0
                      const egpAmount = usdAmount * 50 // Default exchange rate
                      setDepositForm({
                        ...depositForm,
                        amount: e.target.value,
                        amountEGP: egpAmount.toFixed(2)
                      })
                    }}
                    className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-green-500"
                    placeholder="0.00"
                  />
                </div>

                <div>
                  <label className="block text-gray-700 font-bold mb-2">المبلغ (EGP)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={depositForm.amountEGP}
                    onChange={(e) => {
                      const egpAmount = parseFloat(e.target.value) || 0
                      const usdAmount = egpAmount / 50 // Default exchange rate
                      setDepositForm({ 
                        ...depositForm, 
                        amountEGP: e.target.value,
                        amount: usdAmount.toFixed(2)
                      })
                    }}
                    className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-green-500"
                    placeholder="0.00"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-gray-700 font-bold mb-2">المصدر *</label>
                  <select
                    value={depositForm.source === 'Other' || (depositForm.customSource && depositForm.customSource !== depositForm.source) ? 'Other' : depositForm.source}
                    onChange={(e) => {
                      if (e.target.value === 'Other') {
                        setDepositForm({ ...depositForm, source: 'Other', customSource: depositForm.customSource || '' })
                      } else {
                        setDepositForm({ ...depositForm, source: e.target.value, customSource: '' })
                      }
                    }}
                    className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-green-500 bg-white"
                  >
                    <option value="">اختر المصدر</option>
                    <option value="Personal Wallet">محفظة شخصية</option>
                    <option value="Partner Investment">استثمار شريك</option>
                    <option value="Bank Loan">قرض بنكي</option>
                    <option value="External Investor">مستثمر خارجي</option>
                    <option value="Other">أخرى (مخصص)</option>
                  </select>
                </div>

                {(depositForm.source === 'Other' || !depositForm.source) && (
                  <div className="md:col-span-2">
                    <label className="block text-gray-700 font-bold mb-2">حدد المصدر يدوياً *</label>
                    <input
                      type="text"
                      value={depositForm.customSource || ''}
                      onChange={(e) => setDepositForm({ ...depositForm, customSource: e.target.value, source: e.target.value ? 'Other' : '' })}
                      className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-green-500"
                      placeholder="أدخل المصدر..."
                      required
                    />
                  </div>
                )}

                <div>
                  <label className="block text-gray-700 font-bold mb-2">التاريخ *</label>
                  <input
                    type="date"
                    value={depositForm.date}
                    onChange={(e) => setDepositForm({ ...depositForm, date: e.target.value })}
                    className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-green-500"
                    required
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-gray-700 font-bold mb-2">ملاحظات (اختياري)</label>
                  <textarea
                    value={depositForm.description}
                    onChange={(e) => setDepositForm({ ...depositForm, description: e.target.value })}
                    className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-green-500"
                    rows="3"
                    placeholder="مثال: إيداع مبلغ إضافي لصندوق التطوير..."
                  />
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => setShowDepositModal(false)}
                  className="flex-1 px-4 py-2 border-2 border-gray-300 rounded-lg font-bold text-gray-700 hover:bg-gray-50"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-green-500 text-white rounded-lg font-bold hover:bg-green-600"
                >
                  تأكيد الإيداع
                </button>
              </div>
            </form>
          </motion.div>
        </motion.div>
      )}

      {/* Withdraw Modal */}
      {showWithdrawModal && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
          onClick={() => setShowWithdrawModal(false)}
        >
          <motion.div
            initial={{ scale: 0.9, y: 20 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.9, y: 20 }}
            className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-2xl font-bold text-gray-800">💰 سحب من صندوق التطوير</h2>
              <button
                onClick={() => setShowWithdrawModal(false)}
                className="text-gray-500 hover:text-gray-700 text-2xl"
              >
                ×
              </button>
            </div>

            <form onSubmit={handleWithdraw}>
              <div className="space-y-4">
                <div>
                  <label className="block text-gray-700 font-bold mb-2">المبلغ (USD) *</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    required
                    value={withdrawForm.amount}
                    onChange={(e) => {
                      const usdAmount = parseFloat(e.target.value) || 0
                      const egpAmount = usdAmount * 50 // Default exchange rate
                      setWithdrawForm({
                        ...withdrawForm,
                        amount: e.target.value,
                        amountEGP: egpAmount.toFixed(2)
                      })
                    }}
                    className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-red-500"
                    placeholder="0.00"
                  />
                </div>

                <div>
                  <label className="block text-gray-700 font-bold mb-2">المبلغ (EGP)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={withdrawForm.amountEGP}
                    onChange={(e) => setWithdrawForm({ ...withdrawForm, amountEGP: e.target.value })}
                    className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-red-500"
                    placeholder="0.00"
                  />
                </div>

                <div>
                  <label className="block text-gray-700 font-bold mb-2">الوصف</label>
                  <textarea
                    value={withdrawForm.description}
                    onChange={(e) => setWithdrawForm({ ...withdrawForm, description: e.target.value })}
                    className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-red-500"
                    rows="3"
                    placeholder="مثال: شراء أثاث للشقة..."
                  />
                </div>

                {balance.balance - parseFloat(withdrawForm.amount || 0) < 0 && (
                  <div className="p-3 bg-yellow-50 border-2 border-yellow-400 rounded-lg">
                    <p className="text-sm text-yellow-800 font-bold">
                      ⚠️ تحذير: السحب سيؤدي إلى رصيد سالب (مديونية)
                    </p>
                  </div>
                )}
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => setShowWithdrawModal(false)}
                  className="flex-1 px-4 py-2 border-2 border-gray-300 rounded-lg font-bold text-gray-700 hover:bg-gray-50"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-red-500 text-white rounded-lg font-bold hover:bg-red-600"
                >
                  تأكيد السحب
                </button>
              </div>
            </form>
          </motion.div>
        </motion.div>
      )}
    </div>
  )
}

export default DevelopmentFund

