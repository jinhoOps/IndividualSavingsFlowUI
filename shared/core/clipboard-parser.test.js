import { ClipboardParser } from './clipboard-parser.js';

const testCases = [
  {
    name: 'Shinhan Card',
    input: '[Web발신]\n신한카드승인 이*호(6115) 05/11 14:20\n15,600원(일시불)\n쿠팡',
    expected: { amount: 15600, merchant: '쿠팡', date: '05/11' }
  },
  {
    name: 'Hyundai Card',
    input: '[현대카드]-승인\n이*호\n15,600원(일시불)\n05/11 14:20\n배달의민족',
    expected: { amount: 15600, merchant: '배달의민족', date: '05/11' }
  },
  {
    name: 'Toss Bank',
    input: '[토스뱅크] 05/11 14:20 이*호님에게 15,600원 결제(네이버페이)',
    expected: { amount: 15600, merchant: '네이버페이', date: '05/11' }
  },
  {
    name: 'Generic KB',
    input: 'KB카드 05/11 14:20 15,600원 스타벅스 승인',
    expected: { amount: 15600, merchant: '스타벅스', date: '05/11' }
  }
];

console.log('--- Clipboard Parser Test ---');
testCases.forEach(tc => {
  const result = ClipboardParser.parseSms(tc.input);
  const success = result && 
                  result.amount === tc.expected.amount && 
                  result.merchant === tc.expected.merchant && 
                  result.date === tc.expected.date;
  
  console.log(`[${tc.name}] ${success ? '✅ PASS' : '❌ FAIL'}`);
  if (!success) {
    console.log('  Expected:', tc.expected);
    console.log('  Received:', result);
  }
});
